"use client";

import { useState } from "react";

type ComposeFormProps = {
  userId: string;
  defaultTo: string;
  defaultSubject: string;
};

export default function ComposeForm({ userId, defaultTo, defaultSubject }: ComposeFormProps) {
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  return (
    <form className="form" action="/api/send" method="post" encType="multipart/form-data" onSubmit={() => setSending(true)}>
      <div className="field">
        <label htmlFor="from">보내는 사람</label>
        <input id="from" name="from" type="text" value={userId} readOnly />
      </div>
      <div className="field">
        <label htmlFor="to">받는 사람</label>
        <input id="to" name="to" type="text" defaultValue={defaultTo} placeholder="친구 또는 user@example.com" required autoFocus />
        <p className="fieldHint">여러 명에게 보낼 때는 쉼표로 주소를 구분해 주세요.</p>
      </div>
      <div className="field">
        <label htmlFor="subject">제목</label>
        <input id="subject" name="subject" type="text" defaultValue={defaultSubject} placeholder="다음 이야기는 무엇인가요?" />
      </div>
      <div className="field">
        <label htmlFor="body">편지 내용</label>
        <textarea id="body" name="body" placeholder="천천히 마음을 적어보세요." required />
      </div>
      <div className="field">
        <label htmlFor="attachments">첨부파일</label>
        <input className="fileInput" id="attachments" name="attachments" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).map((file) => file.name))} />
        <p className="fieldHint">전체 첨부파일은 최대 1GB까지 가능해요.{files.length ? ` · ${files.length}개 선택: ${files.join(", ")}` : ""}</p>
      </div>
      <div className="actions">
        <a className="textLink" href="/inbox">취소</a>
        <button className="button" type="submit" disabled={sending} aria-busy={sending}>
          {sending ? "편지를 보내는 중…" : "편지 보내기"}
        </button>
      </div>
    </form>
  );
}
