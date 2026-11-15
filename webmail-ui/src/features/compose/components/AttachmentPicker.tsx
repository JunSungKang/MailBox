"use client";
import { useState } from "react";
import FormField from "@/components/ui/FormField";
export default function AttachmentPicker() {
  const [files, setFiles] = useState<string[]>([]);
  return (
    <FormField id="attachments" label="첨부파일">
      <input
        className="fileInput"
        id="attachments"
        name="attachments"
        type="file"
        multiple
        aria-describedby="attachments-hint"
        onChange={(event) =>
          setFiles(
            Array.from(event.target.files || []).map((file) => file.name),
          )
        }
      />
      <p id="attachments-hint" className="fieldHint">
        전체 첨부파일은 최대 1GB까지 가능해요.
        {files.length ? ` · ${files.length}개 선택: ${files.join(", ")}` : ""}
      </p>
    </FormField>
  );
}
