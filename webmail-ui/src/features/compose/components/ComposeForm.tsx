"use client";
import FormField from "@/components/ui/FormField";
import AttachmentPicker from "./AttachmentPicker";

import { useState } from "react";

type ComposeFormProps = {
  userId: string;
  defaultTo: string;
  defaultSubject: string;
};

export default function ComposeForm({
  userId,
  defaultTo,
  defaultSubject,
}: ComposeFormProps) {
  const [sending, setSending] = useState(false);

  return (
    <form
      className="form"
      action="/api/send"
      method="post"
      encType="multipart/form-data"
      onSubmit={() => setSending(true)}
    >
      <FormField id="from" label="보내는 사람">
        <input id="from" name="from" type="text" value={userId} readOnly />
      </FormField>
      <FormField id="to" label="받는 사람">
        <input
          id="to"
          name="to"
          type="text"
          defaultValue={defaultTo}
          placeholder="친구 또는 user@example.com"
          required
          autoFocus
        />
        <p className="fieldHint">
          여러 명에게 보낼 때는 쉼표로 주소를 구분해 주세요.
        </p>
      </FormField>
      <FormField id="subject" label="제목">
        <input
          id="subject"
          name="subject"
          type="text"
          defaultValue={defaultSubject}
          placeholder="다음 이야기는 무엇인가요?"
        />
      </FormField>
      <FormField id="body" label="편지 내용">
        <textarea
          id="body"
          name="body"
          placeholder="천천히 마음을 적어보세요."
          required
        />
      </FormField>
      <AttachmentPicker />
      <div className="actions">
        <a className="textLink" href="/inbox">
          취소
        </a>
        <button
          className="button"
          type="submit"
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? "편지를 보내는 중…" : "편지 보내기"}
        </button>
      </div>
    </form>
  );
}
