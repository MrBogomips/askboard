// The Unicode properties a TextField's `pattern` may name in `\p{…}` and `\P{…}` (form-widget, task
// 1.13; design decision 3): a General_Category value, alone or after `General_Category=` or `gc=`,
// and one of ECMAScript 2018's binary properties (ECMA-262 2018, tables 55 and 57). Script and
// Script_Extensions are left out: a script added to Unicode after a user's browser was built compiles
// on the session process and never on that board. Plain ECMAScript, no DOM, Node or Bun API.

const words = (text: string): ReadonlySet<string> => new Set(text.split(" "));

/** General_Category values, long and short names, with their aliases (ECMA-262 2018, table 57). */
const GENERAL_CATEGORIES = words(
  "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc " +
    "Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf " +
    "Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M " +
    "Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N " +
    "Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So " +
    "Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs " +
    "Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu",
);

/** Binary properties, long and short names (ECMA-262 2018, table 55). */
const BINARY_PROPERTIES = words(
  "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M " +
    "Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM " +
    "Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT " +
    "Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia " +
    "Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext " +
    "Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB " +
    "IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C " +
    "Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax " +
    "Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI " +
    "Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo " +
    "Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS",
);

const CATEGORY_PREFIXES: readonly string[] = ["General_Category=", "gc="];

/** Whether `name`, the text between the braces of `\p{…}`, is a form the subset admits. */
export const propertyNameAllowed = (name: string): boolean => {
  const prefix = CATEGORY_PREFIXES.find((each) => name.startsWith(each));
  if (prefix !== undefined) return GENERAL_CATEGORIES.has(name.slice(prefix.length));
  return GENERAL_CATEGORIES.has(name) || BINARY_PROPERTIES.has(name);
};
