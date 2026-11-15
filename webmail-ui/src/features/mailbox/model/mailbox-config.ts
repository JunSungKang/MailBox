import type { MailBox } from "../../../../backend/domain/mail-types";
export const mailboxConfig = {
  inbox: {
    eyebrow: "Incoming signals · Inbox",
    title: "당신에게 도착한 편지",
    intro: "작은 신호 하나가 새로운 이야기를 열어줄 거예요.",
    emptyTitle: "새로운 이야기가 시작될 곳",
    emptyDescription: "새 편지가 도착하면 이곳에서 열어볼 수 있어요.",
    icon: "◎",
    partyLabel: "보낸 사람",
    dateLabel: "도착한 때",
  },
  sent: {
    eyebrow: "Outgoing signals · Sent",
    title: "당신이 보낸 편지",
    intro: "다음 이야기를 향해 보낸 마음들을 모았어요.",
    emptyTitle: "아직 보낸 편지가 없어요",
    emptyDescription: "다음 이야기는 당신의 한마디로 시작해요.",
    icon: "↗",
    partyLabel: "받는 사람",
    dateLabel: "보낸 때",
  },
  bounced: {
    eyebrow: "Return signals",
    title: "돌아온 편지",
    intro: "전달되지 못하고 돌아온 편지와 이유를 확인하세요.",
    emptyTitle: "돌아온 편지가 없어요",
    emptyDescription: "전달을 확인할 편지가 생기면 이곳에 모아둘게요.",
    icon: "◎",
    partyLabel: "보낸 사람",
    dateLabel: "돌아온 때",
  },
} satisfies Record<
  MailBox,
  {
    eyebrow: string;
    title: string;
    intro: string;
    emptyTitle: string;
    emptyDescription: string;
    icon: string;
    partyLabel: string;
    dateLabel: string;
  }
>;
