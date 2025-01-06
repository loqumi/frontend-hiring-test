import React, {useEffect, useState} from "react";
import { ItemContent, Virtuoso } from "react-virtuoso";
import cn from "clsx";
import {
    MessageSender,
    MessageStatus,
    type Message, MessageEdge,
} from "../__generated__/resolvers-types";
import css from "./chat.module.css";
import {useMutation, useQuery} from "@apollo/client";
import {
    GET_MESSAGES,
    MESSAGE_SUBSCRIPTION,
    SEND_MESSAGE
} from "./graphql/queries";

const Item: React.FC<Message> = ({ text, sender }) => {
  return (
    <div className={css.item}>
      <div
        className={cn(
          css.message,
          sender === MessageSender.Admin ? css.out : css.in
        )}
      >
        {text}
      </div>
    </div>
  );
};

const getItem: ItemContent<Message, unknown> = (_, data) => {
  return <Item {...data} />;
};

interface MessageSubscriptionData {
    messageAdded: Message;
}

export const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [textMessage, setTextMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    const { subscribeToMore } = useQuery<{ messages: { edges: MessageEdge[] } }>(
        GET_MESSAGES,
        {
            variables: { first: 30 },
            notifyOnNetworkStatusChange: true,
            onCompleted: (fetchedData) => {
                const newMessages = fetchedData.messages.edges.map((edge) => edge.node);
                setMessages(newMessages);
            },
        }
    );

    useEffect(() => {
        const unsubscribe = subscribeToMore<MessageSubscriptionData>({
            document: MESSAGE_SUBSCRIPTION,
            updateQuery: (prev, { subscriptionData }) => {
                if (!subscriptionData.data) return prev;

                const newMessage: Message = subscriptionData.data.messageAdded;

                setMessages((prev) => {
                    if (prev.find((msg) => msg.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
                return prev;
            },
        });

        return () => unsubscribe();
    }, [subscribeToMore, messages]);

    const [sendMessage] = useMutation(SEND_MESSAGE);

    const handleSendMessage = async (text: string) => {
        if (isSending) return;
        setTextMessage("");
        setIsSending(true);

        const tempMessage: Message = {
            id: `${messages.length}`,
            text,
            status: MessageStatus.Sending,
            updatedAt: new Date().toISOString(),
            sender: MessageSender.Admin,
            __typename: "Message",
        };

        setMessages((prev) => [...prev, tempMessage]);

        try {
            await sendMessage({
                variables: { text },
                optimisticResponse: {
                    sendMessage: tempMessage,
                },
            });
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

  return (
    <div className={css.root}>
      <div className={css.container}>
        <Virtuoso className={css.list} data={messages} itemContent={getItem} />
      </div>
      <div className={css.footer}>
        <input
          type="text"
          value={textMessage}
          onChange={(e) => setTextMessage(e.target.value)}
          onKeyDown={(e) => {
              if (e.key === "Enter" && !isSending) {
                  if (textMessage) {
                      handleSendMessage(textMessage);
                  }
          }}}
          className={css.textInput}
          placeholder="Message text"
        />
        <button
            disabled={isSending}
            onClick={() => {
                if (textMessage && !isSending) {
                    handleSendMessage(textMessage)}
                }
            }
        >
            {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};
