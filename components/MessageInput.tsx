import React, { FormEvent, KeyboardEvent, useState } from "react";
import { Box, TextInput } from "@primer/components";
import { useMutation } from "react-query";
import { supabase } from "service/supabase";
import type { User as DBUser } from "../types";
import { User } from "@supabase/gotrue-js";

type Props = {
  chatId: string;
  user: User;
};

export const MessageInput = ({ chatId, user }: Props) => {
  const [value, setValue] = useState("");

  const handleChange = (e: FormEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value;
    const latestCharacter = newValue[newValue.length - 1];

    // Not supporting multiline messages for now
    if (latestCharacter !== "\n") {
      setValue(e.currentTarget.value);
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter" && value.trim().length > 0) {
      submitMessage();
      setValue("");
    }
  };

  const { mutate: submitMessage, error } = useMutation(async () => {
    const rawMentionRegexMatches: string[][] = Array.from(value.matchAll(/@[A-Za-z0-9\-]+/g)).map((regexMatchArray) => [
      ...regexMatchArray,
    ]);
    const rawMentions: string[] = [];
    for (let row of rawMentionRegexMatches) for (let e of row) rawMentions.push(e);

    const mentionsRaw: ({ username: string; id: string } | null)[] = await Promise.all(
      rawMentions.map(async (mention) => {
        const username = mention.substring(1);
        const { data: userData } = await supabase.from<DBUser>("users").select("id").eq("username", username);

        if ((userData ?? []).length > 0) {
          const user = userData![0];
          return { username: username, id: user.id };
        }
        return null;
      })
    );

    // @ts-ignore
    const mentions: { username: string; id: string }[] = mentionsRaw.filter((mention) => mention != null);

    let mentionsValue = value;

    mentions.forEach((mention) => {
      mentionsValue = mentionsValue.replace(`@${mention.username}`, `<@${mention.id}>`);
    });

    const { error } = await supabase.from("messages").insert([
      {
        chat_id: chatId,
        user_id: user.id,
        content: mentionsValue,
        mentions: mentions.map((mention) => mention.id),
      },
    ]);

    if (error) {
      // TODO Handle in UI
      console.error(error);
    }
  });

  return (
    <Box paddingX={3} paddingBottom={3} flexShrink={0}>
      <TextInput
        as="textarea"
        height="100%"
        width="100%"
        border="1px solid"
        borderColor="border.subtle"
        sx={{
          backgroundColor: "canvas.overlay",
          ":focus-within": {
            borderColor: "fg.subtle",
            boxShadow: "none",
          },
        }}
        style={{
          // This does not work if set in sx
          resize: "none",
        }}
        value={value}
        onChange={handleChange}
        onKeyUp={handleKeyUp}
      />
    </Box>
  );
};
