/** Autoría anonimizada de los mensajes del foro de quien sale de un equipo. */
export const EX_MEMBER_ID = "ex-member";
export const EX_MEMBER_NAME = "Ex-miembro";

/** Inicial del avatar: neutra («?») para un ex-miembro, sin enlace ni identidad de usuario. */
export function authorInitial(authorId: string | null | undefined, authorName: string): string {
  if (!authorId || authorId === EX_MEMBER_ID) return "?";
  return authorName.charAt(0).toUpperCase();
}
