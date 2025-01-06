import { gql } from "@apollo/client";

export const GET_MESSAGES = gql`
    query GetMessages($first: Int, $after: MessagesCursor, $before: MessagesCursor) {
        messages(first: $first, after: $after, before: $before) {
            edges {
                node {
                    id
                    text
                    status
                    updatedAt
                    sender
                }
                cursor
            }
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
`;

export const MESSAGE_SUBSCRIPTION = gql`
    subscription OnMessageAdded {
        messageAdded {
            id
            text
            status
            updatedAt
            sender
        }
    }
`;
