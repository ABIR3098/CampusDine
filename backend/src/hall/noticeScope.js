// Which hall notices a member may see.
// A notice with no university (university_id IS NULL) was written by someone who is not tied to
// one university, such as the Hall Admin, so it is campus-wide and everybody sees it.
// A notice with a university is shown only to people of that university.
// A member with no university sees every notice.
function noticeScope(universityId) {
  const id = universityId || null;
  return {
    sql: "(? IS NULL OR university_id IS NULL OR university_id = ?)",
    params: [id, id],
  };
}

module.exports = { noticeScope };
