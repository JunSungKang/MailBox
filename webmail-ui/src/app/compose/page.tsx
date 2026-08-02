export default function ComposePage() {
  return (
    <>
      <div className="pageHeader">
        <h1>메일 보내기</h1>
      </div>
      <section className="panel">
        <form className="form" action="/api/send" method="post" encType="multipart/form-data">
          <div className="field">
            <label htmlFor="from">보낸 사람</label>
            <input
              id="from"
              name="from"
              type="text"
              placeholder="jskang"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="to">받는 사람</label>
            <input id="to" name="to" type="text" placeholder="jskang 또는 user@example.com" required />
          </div>
          <div className="field">
            <label htmlFor="subject">제목</label>
            <input id="subject" name="subject" type="text" />
          </div>
          <div className="field">
            <label htmlFor="body">본문</label>
            <textarea id="body" name="body" required />
          </div>
          <div className="field">
            <label htmlFor="attachments">첨부파일</label>
            <input id="attachments" name="attachments" type="file" multiple />
          </div>
          <div className="actions">
            <button className="button" type="submit">
              보내기
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
