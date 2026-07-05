import TextArea from "components/inputs/TextArea.tsx";
import Button from "components/inputs/Button.tsx";
import React, { useContext, useState } from "react";
import { useCreateAnnouncement } from "api/query.ts";
import TextInput from "components/inputs/TextInput.tsx";
import { EventContext } from "contexts/EventContext.ts";

export default function AnnouncementCreationCard() {
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");

  const createAnnouncement = useCreateAnnouncement();
  const dispatchEventMsg = useContext(EventContext);

  function doCreateAnnouncement() {
    if (msg.trim().length === 0 || title.trim().length === 0) {
      return;
    }

    createAnnouncement.mutate(
      { title, message: msg },
      {
        onSettled: () => {
          createAnnouncement.reset();
          setTitle("");
          setMsg("");
        },
        onSuccess: () => {
          dispatchEventMsg({ type: "info", msg: "Announcement has been made" });
        },
      },
    );
  }

  return (
    <div className="card">
      <h1 className="card__title">Make Announcement</h1>
      <div className="card--admin__container">
        <TextInput
          className="staff__text-input"
          placeholder="Type title here"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
        <TextArea
          className="staff__textarea"
          placeholder="Type message here"
          value={msg}
          setValue={setMsg}
        />
        <Button
          children="Send"
          holdToUse={true}
          onClick={doCreateAnnouncement}
          width="100%"
        />
      </div>
    </div>
  );
}
