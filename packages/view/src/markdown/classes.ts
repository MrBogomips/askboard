// The Text's classes (DESIGN.md: Primitives, Display atoms), on the token utilities only, each
// written out in full so that Tailwind finds it in the chunk's own sources; no element takes a
// `style` attribute (AD-8). Markdown's elements carry no class of their own (the sanitizer keeps
// only the three alignment classes), so the container styles them by descendant selectors.

/** Plain text: the body type, line breaks kept, long words wrapped within the card. */
export const PLAIN = "m-0 whitespace-pre-wrap break-words text-body text-foreground";

const BLOCKS =
  "[&_p]:m-0 [&_p+p]:mt-sm [&_p+ul]:mt-sm [&_p+ol]:mt-sm [&_p+pre]:mt-sm [&_p+blockquote]:mt-sm [&_p+table]:mt-sm [&_ul+p]:mt-sm [&_ol+p]:mt-sm [&_pre+p]:mt-sm [&_blockquote+p]:mt-sm [&_table+p]:mt-sm";

const HEADINGS =
  "[&_h1]:mb-xs [&_h1]:mt-sm [&_h1]:text-body-lg [&_h1]:font-semibold [&_h2]:mb-xs [&_h2]:mt-sm [&_h2]:text-body-lg [&_h2]:font-semibold [&_h3]:mb-xs [&_h3]:mt-sm [&_h3]:text-body [&_h3]:font-semibold [&_h4]:mb-xs [&_h4]:mt-sm [&_h4]:text-body [&_h4]:font-semibold [&_h5]:mb-xs [&_h5]:mt-sm [&_h5]:text-body [&_h5]:font-semibold [&_h6]:mb-xs [&_h6]:mt-sm [&_h6]:text-body [&_h6]:font-semibold [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_h4:first-child]:mt-0 [&_h5:first-child]:mt-0 [&_h6:first-child]:mt-0";

const LISTS =
  "[&_ul]:my-xs [&_ul]:list-disc [&_ul]:pl-xl [&_ol]:my-xs [&_ol]:list-decimal [&_ol]:pl-xl [&_li]:my-0";

const INLINE = `[&_strong]:font-semibold [&_em]:italic [&_del]:line-through [&_s]:line-through [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-xs [&_code]:font-mono [&_code]:text-code [&_a]:rounded-sm [&_a]:text-primary-text [&_a]:underline [&_a:hover]:no-underline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-1 [&_a:focus-visible]:outline-ring`;

const BLOCKQUOTE_CODE_RULE =
  "[&_blockquote]:my-xs [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-sm [&_blockquote]:text-foreground-secondary [&_pre]:my-xs [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-sm [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border";

const TABLES =
  "[&_table]:my-xs [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-sm [&_th]:py-xs [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-sm [&_td]:py-xs [&_.md-align-left]:text-left [&_.md-align-center]:text-center [&_.md-align-right]:text-right";

/** The container Markdown is appended into: the body type and a style for each element it holds. */
export const MARKDOWN = `min-w-0 break-words text-body text-foreground ${BLOCKS} ${HEADINGS} ${LISTS} ${INLINE} ${BLOCKQUOTE_CODE_RULE} ${TABLES}`;
