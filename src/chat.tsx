import React, {useEffect, useState} from "react";
import { ItemContent, Virtuoso } from "react-virtuoso";
import cn from "clsx";
import {
    MessageSender,
    MessageStatus,
    type Message, MessageEdge,
} from "../__generated__/resolvers-types";
import css from "./chat.module.css";
import {useQuery} from "@apollo/client";
import {
    GET_MESSAGES,
    MESSAGE_SUBSCRIPTION,
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

export const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);

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
        const unsubscribe = subscribeToMore({
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

  return (
    <div className={css.root}>
      <div className={css.container}>
        <Virtuoso className={css.list} data={messages} itemContent={getItem} />
      </div>
      <div className={css.footer}>
        <input
          type="text"
          className={css.textInput}
          placeholder="Message text"
        />
        <button>Send</button>
      </div>
    </div>
  );
};
