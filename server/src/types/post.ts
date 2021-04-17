import { ApolloError, UserInputError } from "apollo-server";
import { extendType, idArg, objectType, stringArg } from "nexus";
import { Post as PostType } from "@prisma/client";

import { getPaginationData } from "../lib/paginate";
import { validatePost } from "../lib/validate";
import { getSession } from "../lib/auth";
import { User } from "./user";
import { Sub } from "./sub";
import { PaginationInput, PostInput } from "./input";
import { PaginatedComments, PaginatedPosts } from "./page";

export const Post = objectType({
  name: "Post",
  definition(t) {
    t.id("id");
    t.string("title");
    t.string("body");
    t.nullable.string("image");
    t.string("creatorId");
    t.string("subName");
    t.date("createdAt");
    t.date("updatedAt");

    t.field("creator", {
      type: User,
      resolve: (parent, _, { prisma }) =>
        prisma.user.findUnique({ where: { id: parent.creatorId } }),
    });

    t.field("sub", {
      type: Sub,
      resolve: (parent, _, { prisma }) =>
        prisma.sub.findUnique({ where: { name: parent.subName } }),
    });

    t.int("votes", {
      resolve: async (parent, _, { prisma }) => {
        const voteArr = await prisma.postVote.findMany({
          where: { postId: parent.id },
          select: { value: true },
        });
        return voteArr.reduce((prev, curr) => prev + curr.value, 0);
      },
    });

    t.field("comments", {
      type: PaginatedComments,
      args: {
        input: PaginationInput,
      },
      resolve: async (parent, { input }, { prisma }) => {
        const pagination = getPaginationData(input);

        const comments = await prisma.comment.findMany({
          where: { postId: parent.id },
          orderBy: { createdAt: "desc" },
          ...pagination,
        });

        return {
          hasMore: comments.length === input.take + 1,
          comments: comments.slice(0, input.take),
        };
      },
    });

    t.int("voteStatus", {
      resolve: async (parent, _, { req, prisma }) => {
        const session = getSession(req);

        if (!session?.userId) return 0;

        const vote = await prisma.postVote.findUnique({
          where: {
            userId_postId: { userId: session.userId, postId: parent.id },
          },
          select: { value: true },
        });

        if (!vote) {
          return 0;
        }

        return vote.value;
      },
    });
  },
});

export const Mutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("createPost", {
      type: Post,
      args: {
        subName: stringArg(),
        input: PostInput,
      },
      resolve: async (_, { input, subName }, { req, prisma }) => {
        const { userId } = getSession(req, true)!;
        const error = validatePost(input);

        if (error) {
          throw new UserInputError(error);
        }

        try {
          const post = await prisma.post.create({
            data: {
              creatorId: userId,
              subName,
              ...input,
            },
          });
          return post;
        } catch (e) {
          throw new ApolloError("sub not found");
        }
      },
    });

    t.field("editPost", {
      type: Post,
      args: {
        postId: idArg(),
        input: PostInput,
      },
      resolve: async (_, { postId, input }, { req, prisma }) => {
        const { userId } = getSession(req, true)!;

        const postExists = await prisma.post.findUnique({
          where: { id: postId },
        });
        if (!postExists) {
          throw new ApolloError("post not found");
        }
        if (postExists.creatorId !== userId) {
          throw new ApolloError("cannot update post");
        }

        const post = await prisma.post.update({
          where: { id: postId },
          data: { ...input, updatedAt: new Date() },
        });

        return post;
      },
    });

    t.boolean("deletePost", {
      args: {
        postId: idArg(),
      },
      resolve: async (_, { postId }, { req, prisma }) => {
        const { userId } = getSession(req, true)!;

        const postExists = await prisma.post.findUnique({
          where: { id: postId },
        });
        if (!postExists) {
          throw new ApolloError("post not found");
        }
        if (postExists.creatorId !== userId) {
          throw new ApolloError("cannot update post");
        }

        await prisma.post.delete({ where: { id: postId } });
        return true;
      },
    });
  },
});

export const Query = extendType({
  type: "Query",
  definition(t) {
    t.field("post", {
      type: Post,
      args: {
        id: idArg(),
      },
      resolve: (_, { id }, { prisma }) =>
        prisma.post.findUnique({ where: { id } }),
    });

    t.field("feed", {
      type: PaginatedPosts,
      args: {
        input: PaginationInput,
      },
      resolve: async (_, { input }, { req, prisma }) => {
        const session = getSession(req);
        const pagination = getPaginationData(input);

        let posts: PostType[];

        if (session?.userId) {
          const subs = await prisma.userSub.findMany({
            where: { userId: session.userId },
            select: { subName: true },
          });
          const subNames = subs.map((s) => s.subName);
          posts = await prisma.post.findMany({
            where: { subName: { in: subNames } },
            orderBy: { createdAt: "desc" },
            ...pagination,
          });
        } else {
          posts = await prisma.post.findMany({
            orderBy: { createdAt: "desc" },
            ...pagination,
          });
        }

        return {
          hasMore: posts.length === input.take + 1,
          posts: posts.slice(0, input.take),
        };
      },
    });
  },
});