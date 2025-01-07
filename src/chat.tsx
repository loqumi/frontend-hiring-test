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

const ensureUniqueMessages = (messages: Message[]): Message[] => {
    const messageMap = new Map<string, Message>();
    messages.forEach((msg) => messageMap.set(msg.id, msg));
    return Array.from(messageMap.values());
};

export const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [textMessage, setTextMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [endCursor, setEndCursor] = useState<string | null>(null);

    const { subscribeToMore, fetchMore } = useQuery<{
        messages: { edges: MessageEdge[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
    }>(GET_MESSAGES, {
            variables: { first: 30 },
            notifyOnNetworkStatusChange: true,
            onCompleted: (fetchedData) => {
                const initialMessages = fetchedData.messages.edges.map((edge) => edge.node);
                setMessages((prev) => ensureUniqueMessages([...prev, ...initialMessages]));
                setHasNextPage(fetchedData.messages.pageInfo.hasNextPage);
                setEndCursor(fetchedData.messages.pageInfo.endCursor);
            },
    });

    const loadNewerMessages = async () => {
        if (!hasNextPage || loadingMore) return;

        setLoadingMore(true);
        try {
            const { data } = await fetchMore({
                variables: {
                    first: 10,
                    after: endCursor,
                },
            });

            const newerMessages = data.messages.edges.map((edge: MessageEdge) => edge.node);
            setMessages((prev) => ensureUniqueMessages([...prev, ...newerMessages]));
            setHasNextPage(data.messages.pageInfo.hasNextPage);
            setEndCursor(data.messages.pageInfo.endCursor);
        } catch (error) {
            console.error("Error loading newer messages:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        const unsubscribe = subscribeToMore<MessageSubscriptionData>({
            document: MESSAGE_SUBSCRIPTION,
            updateQuery: (prev, { subscriptionData }) => {
                if (!subscriptionData.data) return prev;

                const newMessage = subscriptionData.data.messageAdded;

                setMessages((prev) => ensureUniqueMessages([...prev, newMessage]));

                return prev;
            },
        });

        return () => unsubscribe();
    }, [subscribeToMore]);

    const [sendMessage] = useMutation(SEND_MESSAGE);

    const handleSendMessage = async (text: string) => {
        if (isSending) return;
        setTextMessage("");
        setIsSending(true);

        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            text,
            status: MessageStatus.Sending,
            updatedAt: new Date().toISOString(),
            sender: MessageSender.Admin,
            __typename: "Message",
        };

        setMessages((prev) => ensureUniqueMessages([...prev, tempMessage]));

        try {
            const { data } = await sendMessage({
                variables: { text },
            });

            setMessages((prev) =>
                ensureUniqueMessages(
                    prev.map((msg) =>
                        msg.id === tempMessage.id ? data.sendMessage : msg
                    )
                )
            );
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={css.root}>
            <div className={css.container}>
                <Virtuoso
                    className={css.list}
                    data={messages}
                    itemContent={getItem}
                    endReached={loadNewerMessages}
                    initialTopMostItemIndex={messages.length - 1}
                />
                {loadingMore && <div className={css.loading}>Loading more...</div>}
            </div>
            <div className={css.footer}>
                <input
                    type="text"
                    value={textMessage}
                    onChange={(e) => setTextMessage(e.target.value)}
                    className={css.textInput}
                    placeholder="Message text"
                />
                <button
                    disabled={isSending}
                    onClick={() => {
                        if (textMessage && !isSending) {
                            handleSendMessage(textMessage);
                        }
                    }}
                >
                    {isSending ? "Sending..." : "Send"}
                </button>
            </div>
        </div>
    );
};
