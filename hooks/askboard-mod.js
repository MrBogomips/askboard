/*
AskBoard's mod (hooks/askboard-mod.js), built by `bun run build:mod`: do not edit.

@askboard/contract 0.1.0 (MIT), @askboard/mod 0.1.0 (MIT)

MIT License

Copyright (c) 2026 Giovanni Costagliola

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

ajv 8.20.0 (MIT)

The MIT License (MIT)

Copyright (c) 2015-2021 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  function ucs2length(str) {
    const len = str.length;
    let length = 0;
    let pos = 0;
    let value;
    while (pos < len) {
      length++;
      value = str.charCodeAt(pos++);
      if (value >= 55296 && value <= 56319 && pos < len) {
        value = str.charCodeAt(pos);
        if ((value & 64512) === 56320)
          pos++;
      }
    }
    return length;
  }
  exports.default = ucs2length;
});
// packages/contract/src/constants.ts
var COLLECT_MAX_WAIT_MS = 20 * 60 * 1000;
var COLLECT_PROGRESS_INTERVAL_MS = 60 * 1000;
var ID_PATTERN = "^[A-Za-z0-9_-]{1,64}$";
var VIEW_ID_PREFIX = "u-";

// packages/contract/src/keys/vocabulary.ts
var KEY_HOLDS = Object.freeze([
  "none",
  "shift",
  "alt+shift",
  "mod",
  "mod+shift",
  "char"
]);
var MOD_ALT_KEYS = Object.freeze([
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Enter"
]);
var KEY_SHOWS = Object.freeze([
  "tool",
  "menu",
  "pointer",
  "navigation",
  "panel",
  "native"
]);
const keyBinding = (key, hold = "none") => Object.freeze({ key, hold });
const keys = (...bindings) => Object.freeze({ keys: Object.freeze(bindings) });
const keysWhenSelected = (...bindings) => Object.freeze({ keys: Object.freeze(bindings), when: "selected" });
const alt = (key) => keyBinding(key, "alt+shift");
const mod = (key) => keyBinding(key, "mod+shift");
var KEY_VOCABULARY = Object.freeze({
  "cursor.up": keys(keyBinding("ArrowUp")),
  "cursor.down": keys(keyBinding("ArrowDown")),
  "cursor.left": keys(keyBinding("ArrowLeft")),
  "cursor.right": keys(keyBinding("ArrowRight")),
  "cursor.first": keys(keyBinding("Home")),
  "cursor.last": keys(keyBinding("End")),
  "select.toggle": keys(keyBinding(" ")),
  "select.extendUp": keys(keyBinding("ArrowUp", "shift")),
  "select.extendDown": keys(keyBinding("ArrowDown", "shift")),
  "select.all": keys(keyBinding("a", "mod")),
  "select.none": keysWhenSelected(keyBinding("Escape")),
  "move.up": keys(alt("ArrowUp")),
  "move.down": keys(alt("ArrowDown")),
  "move.left": keys(alt("ArrowLeft")),
  "move.right": keys(alt("ArrowRight")),
  "move.top": keys(alt("Home"), mod("ArrowUp")),
  "move.bottom": keys(alt("End"), mod("ArrowDown")),
  "add.after": keys(alt("Enter")),
  "add.child": keys(mod("Enter")),
  "edit.start": keys(keyBinding("Enter"), keyBinding("F2")),
  "edit.commit": keys(keyBinding("Enter")),
  "edit.cancel": keys(keyBinding("Escape")),
  delete: keys(keyBinding("Delete"), keyBinding("Backspace"), alt("Delete"), alt("Backspace")),
  "adjust.percent": keysWhenSelected(keyBinding("%", "char")),
  undo: keys(keyBinding("z", "mod")),
  "keys.open": keys(keyBinding("?", "char")),
  "toolbar.previous": keys(keyBinding("ArrowLeft")),
  "toolbar.next": keys(keyBinding("ArrowRight")),
  "toolbar.first": keys(keyBinding("Home")),
  "toolbar.last": keys(keyBinding("End"))
});
const vocabularyLabel = (action) => `keys.action.${action}`;
var ACTS_READ_ONLY = /^(cursor|toolbar)\.|^keys\.open$/;
const vocabularyEntry = (action, part, shows, options = {}) => {
  const { keys: given, when } = KEY_VOCABULARY[action];
  return Object.freeze({
    action,
    part,
    keys: options.keys ?? given,
    label: options.label ?? vocabularyLabel(action),
    shows,
    readOnly: options.readOnly ?? ACTS_READ_ONLY.test(action),
    ...when === undefined ? {} : { when }
  });
};
const ownEntry = (action, part, bindings, shows, options) => Object.freeze({
  action,
  part,
  keys: Object.freeze([...bindings]),
  label: options.label ?? vocabularyLabel(action),
  shows,
  readOnly: options.readOnly
});
// packages/contract/src/schemas/board-document/board-document.json
var board_document_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:board-document:board-document",
  title: "Board document",
  description: "What a board shows of an ask, as ask-core holds it now (AD-12): its ID, its title, the presentation and delivery the ask requests, and its items as the input format places them: questions, or areas holding questions, never both at the top level and never an area in an area, each question with its current revision (AD-20). Since 1.2 a question's context items carry what ask-core resolved (excerpts, design decision 2), and since 1.3 the document names its language and locale (settings-languages). It holds no draft, no event and no token.",
  type: "object",
  properties: {
    version: {
      description: "The board document version, as major.minor. A receiver supports major 1 and accepts any of its minors (design decision 2). A minor keeps the major's meaning: it may add fields and enum values, make a required field optional, and lift or add a limit. Every level refuses what it does not define or allow, so a minor is used only once both ends, ask-core and the board page, have it, which holds because the session process that runs ask-core also serves the board page.",
      type: "string",
      pattern: "^1\\.(0|[1-9][0-9]*)$"
    },
    askId: {
      $ref: "urn:askboard:input:id"
    },
    title: {
      type: "string",
      minLength: 1,
      maxLength: 256
    },
    presentation: {
      enum: ["sections", "tabs", "one-per-view"]
    },
    delivery: {
      enum: ["immediate", "submitted"]
    },
    language: {
      description: "The ask's language, fixed when ask-core accepted the ask (FR-34). A document without it reads as en-US, as one of an earlier minor does.",
      enum: ["en-US", "it-IT"]
    },
    locale: {
      description: "The ask's locale, for the values the board shows and reads, fixed with the language. A document without it reads as its language.",
      enum: ["en-US", "it-IT"]
    },
    items: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "#/$defs/item"
      }
    }
  },
  required: ["version", "askId", "title", "items"],
  additionalProperties: false,
  if: {
    properties: {
      items: {
        type: "array",
        contains: {
          type: "object",
          properties: {
            type: {
              const: "area"
            }
          },
          required: ["type"]
        }
      }
    },
    required: ["items"]
  },
  then: {
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              const: "area"
            }
          },
          required: ["type"]
        }
      }
    }
  },
  $defs: {
    item: {
      description: "An item, picked by its type: a question or an area.",
      type: "object",
      discriminator: {
        propertyName: "type"
      },
      oneOf: [
        {
          $ref: "#/$defs/question"
        },
        {
          $ref: "#/$defs/area"
        }
      ]
    },
    question: {
      type: "object",
      properties: {
        type: {
          const: "question"
        },
        id: {
          $ref: "urn:askboard:input:id"
        },
        rev: {
          type: "integer",
          minimum: 1
        },
        props: {
          $ref: "#/$defs/questionProps"
        }
      },
      required: ["type", "id", "rev", "props"],
      additionalProperties: false
    },
    area: {
      type: "object",
      properties: {
        type: {
          const: "area"
        },
        id: {
          $ref: "urn:askboard:input:id"
        },
        props: {
          $ref: "#/$defs/areaProps"
        }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    areaProps: {
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 1
        },
        items: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/question"
          }
        }
      },
      required: ["title", "items"],
      additionalProperties: false
    },
    questionProps: {
      description: "A question's props: the input format's fields, whose context items carry what ask-core resolved (excerpts, design decision 2).",
      type: "object",
      properties: {
        text: { $ref: "urn:askboard:input:question-props#/properties/text" },
        header: { $ref: "urn:askboard:input:question-props#/properties/header" },
        options: { $ref: "urn:askboard:input:question-props#/properties/options" },
        multiSelect: { $ref: "urn:askboard:input:question-props#/properties/multiSelect" },
        allowOther: { $ref: "urn:askboard:input:question-props#/properties/allowOther" },
        items: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/contextItem" }
        }
      },
      required: ["text"],
      additionalProperties: false
    },
    contextItem: {
      description: "An item of a question, picked by its type: a resolved context item, or a Tree or a Gantt as ask-core expanded it (widget-answers); a molecule reference is never one.",
      type: "object",
      discriminator: { propertyName: "type" },
      oneOf: [
        { $ref: "#/$defs/excerpt" },
        { $ref: "#/$defs/reference" },
        { $ref: "#/$defs/image" }
      ]
    },
    excerpt: {
      type: "object",
      properties: {
        type: { const: "excerpt" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:board-document:excerpt-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    reference: {
      type: "object",
      properties: {
        type: { const: "reference" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:board-document:reference-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    image: {
      type: "object",
      properties: {
        type: { const: "image" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:board-document:image-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/schemas/input/question-props.json
var question_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:question-props",
  title: "Question props",
  description: "A question: its text, optional header chip, options, multiSelect, and allowOther, which offers the \"Other…\" row (FR-3). An option is its label, unique within the question, an optional description, preview and annotation, each plain text, and recommended, which at most one option of a question sets (proposal, open question 9); the contract's validation function checks the uniqueness rules. Since input format 1.2 a question's `items` hold its context, each picked by its `type`: excerpts, references and images (excerpts, design decision 2). Since input format 1.4 `options` is optional and `items` also hold the widget items `tree`, `gantt` and `molecule`, each with its type's props (widget-answers, design decision 3); a question holds options, items or both, which the contract's validation function checks.",
  type: "object",
  properties: {
    text: { type: "string", minLength: 1 },
    header: { type: "string", minLength: 1 },
    options: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/option" }
    },
    multiSelect: { type: "boolean" },
    allowOther: { type: "boolean" },
    items: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/item" }
    }
  },
  required: ["text"],
  additionalProperties: false,
  $defs: {
    option: {
      type: "object",
      properties: {
        label: { type: "string", minLength: 1 },
        description: { type: "string" },
        preview: { type: "string", minLength: 1, maxLength: 1e4 },
        previewFormat: { enum: ["plain", "markdown"] },
        annotation: { type: "string", minLength: 1, maxLength: 2000 },
        recommended: { const: true }
      },
      required: ["label"],
      additionalProperties: false
    },
    item: {
      description: "An item of a question, picked by its type: a context item (excerpt, reference, image) or a widget item (tree, gantt, molecule).",
      type: "object",
      discriminator: { propertyName: "type" },
      oneOf: [
        { $ref: "#/$defs/excerpt" },
        { $ref: "#/$defs/reference" },
        { $ref: "#/$defs/image" },
        { $ref: "#/$defs/molecule" }
      ]
    },
    excerpt: {
      type: "object",
      properties: {
        type: { const: "excerpt" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:input:excerpt-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    reference: {
      type: "object",
      properties: {
        type: { const: "reference" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:input:reference-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    image: {
      type: "object",
      properties: {
        type: { const: "image" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:input:image-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    molecule: {
      type: "object",
      properties: {
        type: { const: "molecule" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:input:molecule-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/schemas/tool-envelopes/fetch-result.json
var fetch_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:tool-envelopes:fetch-result",
  title: "Fetch result",
  description: "What fetch returns for an item of an open or closed ask whose full value fits one result (FR-20, AD-6): the versions, the epoch, the ask's ID and state, and the item as ask-core holds it now. Nothing of the draft record. A longer value comes in pages (fetch-page). An ask without an owner check is unchecked (AD-5). Since 1.2, a question's context items are the board document's without an excerpt's text, written or read, or an image's bytes, at any depth (excerpts, design decision 4).",
  type: "object",
  properties: {
    versions: {
      $ref: "urn:askboard:tool-envelopes:versions"
    },
    epoch: {
      $ref: "urn:askboard:output:epoch"
    },
    askId: {
      $ref: "urn:askboard:input:id"
    },
    state: {
      $ref: "urn:askboard:output:ask-state"
    },
    item: {
      $ref: "#/$defs/item"
    },
    unchecked: {
      const: true
    }
  },
  required: ["versions", "epoch", "askId", "state", "item"],
  additionalProperties: false,
  $defs: {
    item: {
      description: "An item as ask-core holds it now: a question with its type, rev, props and state, its current answer when it is answered or declined, and its previous answer after a reopen; or an area with its title and questions, which has no rev or state of its own.",
      type: "object",
      properties: {
        type: {
          enum: ["question", "area"]
        },
        id: {
          $ref: "urn:askboard:input:id"
        },
        rev: {
          type: "integer",
          minimum: 1
        },
        props: {
          type: "object"
        },
        questionId: {
          $ref: "urn:askboard:input:id"
        },
        state: {
          $ref: "urn:askboard:output:question-state"
        },
        answer: {
          $ref: "#/$defs/answer"
        },
        previous: {
          $ref: "#/$defs/answer"
        },
        result: {
          description: "Since widget-registry: a widget item fetched alone with the result its latest answer gave for it, any JSON value its type defines (FR-20); never on a question or an area."
        }
      },
      required: ["type", "id", "props"],
      additionalProperties: false,
      then: {
        description: "A widget item fetched alone, as the user left it: its question's ID and state, and its props (FR-20, AD-9).",
        required: ["questionId", "state"],
        properties: {
          questionId: true,
          state: true,
          rev: false,
          answer: false,
          previous: false,
          result: true,
          props: true
        }
      },
      else: {
        if: {
          properties: {
            type: {
              const: "area"
            }
          }
        },
        then: {
          properties: {
            questionId: false,
            rev: false,
            state: false,
            answer: false,
            previous: false,
            result: false,
            props: {
              $ref: "#/$defs/areaProps"
            }
          }
        },
        else: {
          required: ["rev", "state"],
          properties: {
            questionId: false,
            result: false,
            props: {
              $ref: "#/$defs/questionProps"
            },
            rev: true,
            state: true
          },
          if: {
            properties: {
              state: {
                enum: ["answered", "declined"]
              }
            }
          },
          then: {
            properties: {
              answer: true
            },
            required: ["answer"]
          },
          else: {
            properties: {
              answer: false
            }
          }
        }
      }
    },
    answer: {
      description: "An answer in full as ask-core holds it (FR-20): its content, who and when, and either the cursor of its answer event or recorded, for an answer the agent recorded, which has no event (proposal, open question 3).",
      type: "object",
      properties: {
        cursor: {
          $ref: "urn:askboard:output:cursor"
        },
        choice: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1
          }
        },
        other: {
          type: "string",
          minLength: 1,
          maxLength: 1e4
        },
        optionNotes: {
          type: "object",
          minProperties: 1,
          propertyNames: {
            type: "string",
            minLength: 1
          },
          additionalProperties: {
            type: "string",
            minLength: 1,
            maxLength: 2000
          }
        },
        note: {
          type: "string",
          minLength: 1
        },
        values: {
          description: "Since 1.4: the full props of each widget item the answer changed, by item ID in reference addressing, as the user sent them (FR-20, AD-20).",
          type: "object",
          minProperties: 1,
          propertyNames: {
            $ref: "urn:askboard:input:id"
          },
          additionalProperties: {
            type: "object"
          }
        },
        results: {
          description: "Since widget-registry: the result each widget item gave, by item ID in reference addressing, each any JSON value its item's type defines (FR-20, AD-20).",
          type: "object",
          minProperties: 1,
          propertyNames: {
            $ref: "urn:askboard:input:id"
          },
          additionalProperties: true
        },
        derived: {
          description: "Since 1.4: the derived values of the question's computing items as the user's board reported them, by reference (AD-13, FR-12), each any JSON value.",
          type: "object",
          minProperties: 1,
          propertyNames: {
            $ref: "urn:askboard:output:answer-event#/$defs/reference"
          },
          additionalProperties: true
        },
        declined: {
          const: true
        },
        who: {
          type: "string",
          minLength: 1,
          maxLength: 256
        },
        when: {
          $ref: "urn:askboard:output:time"
        },
        recorded: {
          const: true
        }
      },
      required: ["who", "when"],
      additionalProperties: false,
      if: {
        properties: {
          recorded: {
            const: true
          }
        },
        required: ["recorded"]
      },
      then: {
        properties: {
          cursor: false
        }
      },
      else: {
        properties: {
          cursor: true
        },
        required: ["cursor"]
      }
    },
    areaProps: {
      description: "An area's title and questions, each as the question below.",
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        items: { type: "array", minItems: 1, items: { $ref: "#/$defs/question" } }
      },
      required: ["title", "items"],
      additionalProperties: false
    },
    question: {
      description: "A question of an area, as the board document holds it, its props as fetch gives them.",
      type: "object",
      properties: {
        type: { const: "question" },
        id: { $ref: "urn:askboard:input:id" },
        rev: { type: "integer", minimum: 1 },
        props: { $ref: "#/$defs/questionProps" }
      },
      required: ["type", "id", "rev", "props"],
      additionalProperties: false
    },
    questionProps: {
      description: "A question's props as fetch gives them: the input format's fields, and its context items as the board document holds them, less excerpt text and image bytes (excerpts, design decision 4).",
      type: "object",
      properties: {
        text: { $ref: "urn:askboard:input:question-props#/properties/text" },
        header: { $ref: "urn:askboard:input:question-props#/properties/header" },
        options: { $ref: "urn:askboard:input:question-props#/properties/options" },
        multiSelect: { $ref: "urn:askboard:input:question-props#/properties/multiSelect" },
        allowOther: { $ref: "urn:askboard:input:question-props#/properties/allowOther" },
        items: { type: "array", minItems: 1, items: { $ref: "#/$defs/contextItem" } }
      },
      required: ["text"],
      additionalProperties: false
    },
    contextItem: {
      description: "A context item, picked by its type.",
      type: "object",
      discriminator: { propertyName: "type" },
      oneOf: [
        { $ref: "#/$defs/excerpt" },
        { $ref: "#/$defs/reference" },
        { $ref: "#/$defs/image" }
      ]
    },
    excerpt: {
      type: "object",
      properties: {
        type: { const: "excerpt" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "#/$defs/excerptProps" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    reference: {
      type: "object",
      properties: {
        type: { const: "reference" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "urn:askboard:board-document:reference-props" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    image: {
      type: "object",
      properties: {
        type: { const: "image" },
        id: { $ref: "urn:askboard:input:id" },
        props: { $ref: "#/$defs/imageProps" }
      },
      required: ["type", "id", "props"],
      additionalProperties: false
    },
    excerptProps: {
      description: "An excerpt without its text: by pointer, its status, and its media type and lines when resolved or its reason when not; written by the agent, its title only.",
      type: "object",
      properties: {
        pointer: { $ref: "urn:askboard:input:pointer" },
        title: { $ref: "urn:askboard:board-document:excerpt-props#/properties/title" },
        status: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/status" },
        reason: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/reason" },
        mediaType: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/textMediaType" },
        lines: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/lines" }
      },
      additionalProperties: false,
      if: { properties: { pointer: true }, required: ["pointer"] },
      then: {
        properties: { status: true },
        required: ["status"],
        if: { properties: { status: { const: "resolved" } } },
        then: {
          properties: { mediaType: true, lines: true, reason: false },
          required: ["mediaType", "lines"]
        },
        else: {
          properties: { reason: true, mediaType: false, lines: false },
          required: ["reason"]
        }
      },
      else: {
        properties: { status: false, reason: false, mediaType: false, lines: false }
      }
    },
    imageProps: {
      description: "An image without its bytes: its pointer, alt text and status, and its media type when resolved or its reason when not.",
      type: "object",
      properties: {
        pointer: { $ref: "urn:askboard:input:pointer" },
        alt: { $ref: "urn:askboard:board-document:image-props#/properties/alt" },
        status: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/status" },
        reason: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/reason" },
        mediaType: { $ref: "urn:askboard:board-document:excerpt-props#/$defs/imageMediaType" }
      },
      required: ["pointer", "alt", "status"],
      additionalProperties: false,
      if: { properties: { status: { const: "resolved" } } },
      then: { properties: { mediaType: true, reason: false }, required: ["mediaType"] },
      else: { properties: { reason: true, mediaType: false }, required: ["reason"] }
    }
  }
};
// packages/contract/src/widgets/approval/approval-props.json
var approval_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:approval-props",
  title: "Approval props",
  description: "An Approval item's props (FR-11, approval-scale-ranking design decision 1): none, an empty object. The Approval gives a decision on the content of the question that holds it, which the board reads from the question's other items. In the input format since approval-scale-ranking.",
  type: "object",
  properties: {},
  additionalProperties: false
};
// packages/contract/src/widgets/approval/approval-result.json
var approval_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:approval-result",
  title: "Approval result",
  description: "An Approval's result (FR-11, FR-18, approval-scale-ranking design decision 1): the user's decision, one of approve, approve-with-changes or reject, and nothing else. The reason travels as the answer's note, never here; what the answer must hold beside a decision is a check of the type (design decision 2). Never empty: the decision is required. In the output format since approval-scale-ranking.",
  type: "object",
  properties: {
    decision: {
      enum: ["approve", "approve-with-changes", "reject"]
    }
  },
  required: ["decision"],
  additionalProperties: false
};

// packages/contract/src/problems.ts
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const segmentsOf = (path) => path === "" || path === "/" ? [] : path.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));

// packages/contract/src/widgets/approval/constants.ts
var APPROVAL_DECISIONS = /* @__PURE__ */ Object.freeze([
  "approve",
  "approve-with-changes",
  "reject"
]);

// packages/contract/src/widgets/approval/checks.ts
const isDecision = (result, decision) => typeof result === "object" && result !== null && result.decision === decision;
const approvalNeedsReason = (result) => isDecision(result, "approve-with-changes");
const noteHoldsReason = (note) => note !== undefined && /[^\s\u0085]/.test(note);
const approvalAnswerProblems = (result, answer) => [
  ...approvalNeedsReason(result) && !noteHoldsReason(answer.note) ? ["approving with changes needs the reason in the note"] : [],
  ...isDecision(result, "approve") && answer.changed ? ["an answer that changes the content approves with changes"] : []
];
const approvalPropsProblems = () => [];
const approvalResultShape = (result) => {
  if (!isRecord(result))
    return false;
  const keys = Object.keys(result);
  return keys.length === 1 && keys[0] === "decision" && APPROVAL_DECISIONS.includes(result.decision);
};

// packages/contract/src/widgets/approval/wording.ts
var APPROVAL_EXPECTED = {
  "approval.props": "an Approval's props, an empty object {}"
};
var APPROVAL_FIELDS = {
  "approval.props": "an Approval's props hold no field: use {}"
};

// packages/contract/src/widgets/approval/widget.ts
var APPROVAL_WIDGET = {
  type: "approval",
  noun: "an Approval",
  props: approval_props_default,
  propsProblems: approvalPropsProblems,
  result: {
    schema: approval_result_default,
    shape: approvalResultShape,
    answerProblems: approvalAnswerProblems
  },
  wording: { expected: APPROVAL_EXPECTED, fields: APPROVAL_FIELDS },
  example: { item: { type: "approval", id: "verdict", props: {} } },
  help: {
    mouse: "Press Approve, Approve with changes or Reject. For changes, write the reason in the note that opens.",
    answer: "The agent receives your decision, your reason if you gave one, and any changes you made to the question's other items."
  },
  skill: {
    use: "a decision on its question's content: approve, approve with changes or reject; put it last in the question it approves",
    notes: [
      "The reason arrives as the answer's `note`; `approve-with-changes` always has one.",
      "An answer that edits the question's other items never carries `approve`."
    ]
  }
};
// packages/contract/src/widgets/chart/chart-props.json
var chart_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:chart-props",
  title: "Chart props",
  description: "A Chart item's props (FR-11, chart-widget design decision 1): a kind (bar, line or pie), 1 to 100 categories and 1 to 5 series, each series holding one number within 1e15 either way, or null, per category in the categories' order, and optionally a title, the labels of the two axes, a unit and highlights (many when absent). What a schema cannot say (the IDs unique, a value for every category, at least one number, what a pie takes) is checked by chartPropsProblems. In the input format since chart-widget.",
  type: "object",
  properties: {
    kind: { enum: ["bar", "line", "pie"] },
    categories: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { $ref: "#/$defs/category" }
    },
    series: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { $ref: "#/$defs/series" }
    },
    title: { type: "string", minLength: 1, maxLength: 120 },
    valueLabel: { type: "string", minLength: 1, maxLength: 60 },
    categoryLabel: { type: "string", minLength: 1, maxLength: 60 },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    highlights: { enum: ["many", "one", "none"] }
  },
  required: ["kind", "categories", "series"],
  additionalProperties: false,
  $defs: {
    category: {
      description: "A category of the chart: its ID, unique among the item's categories, and its label.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 60 }
      },
      required: ["id", "label"],
      additionalProperties: false
    },
    series: {
      description: "A series of the chart: its ID, unique among the item's series, its label and one number or null per category, in the categories' order.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 60 },
        values: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: ["number", "null"],
            minimum: -1000000000000000,
            maximum: 1000000000000000
          }
        }
      },
      required: ["id", "label", "values"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/chart/chart-result.json
var chart_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:chart-result",
  title: "Chart result",
  description: "A Chart's result (FR-11, FR-18, chart-widget design decision 1): 1 to 500 points the user highlighted, each the ID of a series and the ID of a category. That each point names a series and a category of the item's props whose value is a number, that no point is named twice, and how many points the item's highlights take are checks of the type against the item's props. Never empty. In the output format since chart-widget.",
  type: "object",
  properties: {
    points: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        properties: {
          series: { $ref: "urn:askboard:input:id" },
          category: { $ref: "urn:askboard:input:id" }
        },
        required: ["series", "category"],
        additionalProperties: false
      }
    }
  },
  required: ["points"],
  additionalProperties: false
};

// packages/contract/src/widgets/chart/constants.ts
var CHART_MAX_CATEGORIES = 100;
var CHART_MAX_SERIES = 5;
var CHART_PIE_MAX_SLICES = 5;
var CHART_VALUE_LIMIT = 1000000000000000;
var CHART_MAX_POINTS = 500;
var CHART_LABEL_MAX_CHARS = 60;
var CHART_TITLE_MAX_CHARS = 120;
var CHART_UNIT_MAX_CHARS = 20;

// packages/contract/src/widgets/chart/checks.ts
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const listOf = (props, key) => Array.isArray(props[key]) ? props[key] : [];
const quoted = (id) => JSON.stringify(String(id).slice(0, 64));
const repeatedIds = (elements, list, noun) => {
  const seen = new Set;
  const problems = [];
  elements.forEach((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    if (typeof id !== "string")
      return;
    if (seen.has(id)) {
      problems.push({
        path: `/${list}/${index}/id`,
        message: `the ID ${quoted(id)} is held twice: each ${noun} of a Chart has an ID of its own`
      });
    }
    seen.add(id);
  });
  return problems;
};
const valuesOf = (series) => isRecord(series) && Array.isArray(series.values) ? series.values : [];
const lengthProblems = (series, categories) => series.flatMap((one, index) => {
  if (!isRecord(one) || !Array.isArray(one.values) || one.values.length === categories)
    return [];
  const name = typeof one.id === "string" ? `series ${quoted(one.id)}` : `series ${index + 1}`;
  const values = one.values.length === 1 ? "1 value" : `${one.values.length} values`;
  const held = categories === 1 ? "1 category" : `${categories} categories`;
  return [
    {
      path: `/series/${index}/values`,
      message: `${name} holds ${values} for ${held}: each series holds one value per category, in the categories' order, null for none`
    }
  ];
});
const pieProblems = (props, categories, series, numbers) => {
  const problems = [];
  if (categories.length > CHART_PIE_MAX_SLICES) {
    problems.push({
      path: "/categories",
      message: `a pie takes at most ${CHART_PIE_MAX_SLICES} categories, one slice each, and this one has ${categories.length}`
    });
  }
  if (series.length > 1) {
    problems.push({
      path: "/series",
      message: `a pie takes one series, and this one has ${series.length}`
    });
  }
  series.forEach((one, at) => {
    valuesOf(one).forEach((value, index) => {
      if (finite(value) && value < 0) {
        problems.push({
          path: `/series/${at}/values/${index}`,
          message: `a pie takes no negative value, and this one is ${value}`
        });
      }
    });
  });
  if (numbers.length > 0 && !numbers.some((value) => value > 0)) {
    problems.push({
      path: series.length > 1 ? "/series" : "/series/0/values",
      message: "a pie takes at least one value above 0"
    });
  }
  for (const key of ["valueLabel", "categoryLabel"]) {
    if (props[key] !== undefined) {
      problems.push({ path: `/${key}`, message: `a pie takes no ${key}: it has no axes` });
    }
  }
  return problems;
};
const chartPropsProblems = (props) => {
  if (!isRecord(props))
    return [];
  const categories = listOf(props, "categories");
  const series = listOf(props, "series");
  const numbers = series.flatMap((one) => valuesOf(one).filter(finite));
  const pie = props.kind === "pie";
  const problems = [
    ...repeatedIds(categories, "categories", "category"),
    ...repeatedIds(series, "series", "series"),
    ...lengthProblems(series, categories.length)
  ];
  if (pie)
    problems.push(...pieProblems(props, categories, series, numbers));
  if (series.length > 0 && categories.length > 0 && numbers.length === 0) {
    problems.push({
      path: "/series",
      message: "a chart holds at least one number: every value is null"
    });
  }
  return problems;
};
const reading = (props) => {
  if (!isRecord(props) || !Array.isArray(props.categories) || !Array.isArray(props.series)) {
    return;
  }
  const positions = new Map;
  props.categories.forEach((category, index) => {
    const id = isRecord(category) ? category.id : undefined;
    if (typeof id === "string" && !positions.has(id))
      positions.set(id, index);
  });
  const values = new Map;
  for (const series of props.series) {
    const id = isRecord(series) ? series.id : undefined;
    if (typeof id === "string" && !values.has(id))
      values.set(id, valuesOf(series));
  }
  return { values, positions, highlights: props.highlights };
};
const pointText = (series, category) => `(series ${quoted(series)}, category ${quoted(category)})`;
const pointProblems = (point, index, read, seen) => {
  if (!isRecord(point))
    return [];
  const { series, category } = point;
  if (typeof series !== "string" || typeof category !== "string")
    return [];
  const at = (field, message) => ({
    path: `/points/${index}${field}`,
    message
  });
  const named = `the point ${pointText(series, category)}`;
  const problems = [];
  const values = read.values.get(series);
  const position = read.positions.get(category);
  if (values === undefined) {
    problems.push(at("/series", `${named} names the series ${quoted(series)}, which the chart does not hold`));
  }
  if (position === undefined) {
    problems.push(at("/category", `${named} names the category ${quoted(category)}, which the chart does not hold`));
  }
  if (values !== undefined && position !== undefined) {
    if (!finite(values[position])) {
      problems.push(at("", `${named} has no value: the chart holds null there`));
    }
    const key = JSON.stringify([series, category]);
    if (seen.has(key))
      problems.push(at("", `${named} is named twice`));
    seen.add(key);
  }
  return problems;
};
const chartResultProblems = (result, props) => {
  const read = reading(props);
  if (read === undefined) {
    return [
      { path: "/", message: "the item's props are no Chart's, so its points cannot be checked" }
    ];
  }
  const points = isRecord(result) && Array.isArray(result.points) ? result.points : [];
  if (read.highlights === "none") {
    return [{ path: "/points", message: "this chart takes no highlight: its highlights are none" }];
  }
  const problems = [];
  if (read.highlights === "one" && points.length !== 1) {
    problems.push({
      path: "/points",
      message: `this chart takes one point, and the result names ${points.length}`
    });
  }
  const seen = new Set;
  points.forEach((point, index) => {
    problems.push(...pointProblems(point, index, read, seen));
  });
  return problems;
};
var ID = new RegExp(ID_PATTERN);
const isPoint = (point) => {
  if (!isRecord(point))
    return false;
  const keys = Object.keys(point);
  const { series, category } = point;
  return keys.length === 2 && typeof series === "string" && typeof category === "string" && ID.test(series) && ID.test(category);
};
const chartResultShape = (result) => {
  if (!isRecord(result))
    return false;
  const keys = Object.keys(result);
  const { points } = result;
  return keys.length === 1 && keys[0] === "points" && Array.isArray(points) && points.length >= 1 && points.length <= CHART_MAX_POINTS && points.every(isPoint);
};

// packages/contract/src/widgets/chart/keys.ts
var PLOT = "plot";
var CHART_KEYS = [
  vocabularyEntry("cursor.up", PLOT, "navigation"),
  vocabularyEntry("cursor.down", PLOT, "navigation"),
  vocabularyEntry("cursor.left", PLOT, "navigation"),
  vocabularyEntry("cursor.right", PLOT, "navigation"),
  vocabularyEntry("cursor.first", PLOT, "navigation"),
  vocabularyEntry("cursor.last", PLOT, "navigation"),
  ownEntry("chart.highlight", PLOT, [keyBinding(" "), keyBinding("Enter")], "pointer", {
    readOnly: false
  })
];

// packages/contract/src/widgets/wording-parts.ts
var ID_SHAPE = "an ID of 1 to 64 characters from A-Z, a-z, 0-9, _ and -";
const text = (max) => `text of 1 to ${max} characters`;
const isIndex = (segment) => segment !== undefined && /^(0|[1-9][0-9]*)$/.test(segment);

// packages/contract/src/widgets/chart/wording.ts
var NUMBER = `a number from -${CHART_VALUE_LIMIT.toFixed(0)} to ${CHART_VALUE_LIMIT.toFixed(0)}`;
var CHART_EXPECTED = {
  "chart.props": "a Chart's props {kind, categories, series, title?, valueLabel?, categoryLabel?, unit?, highlights?}",
  "chart.props.kind": '"bar", "line" or "pie"',
  "chart.props.categories": `a list of 1 to ${CHART_MAX_CATEGORIES} categories, each {id, label}`,
  "chart.props.categories[]": "a category {id, label}",
  "chart.props.categories[].id": `${ID_SHAPE}, unique among the Chart's categories`,
  "chart.props.categories[].label": text(CHART_LABEL_MAX_CHARS),
  "chart.props.series": `a list of 1 to ${CHART_MAX_SERIES} series, each {id, label, values}`,
  "chart.props.series[]": "a series {id, label, values}",
  "chart.props.series[].id": `${ID_SHAPE}, unique among the Chart's series`,
  "chart.props.series[].label": text(CHART_LABEL_MAX_CHARS),
  "chart.props.series[].values": `a list with one value per category, in the categories' order: ${NUMBER}, or null for none`,
  "chart.props.series[].values[]": `${NUMBER}, or null for none`,
  "chart.props.title": text(CHART_TITLE_MAX_CHARS),
  "chart.props.valueLabel": text(CHART_LABEL_MAX_CHARS),
  "chart.props.categoryLabel": text(CHART_LABEL_MAX_CHARS),
  "chart.props.unit": text(CHART_UNIT_MAX_CHARS),
  "chart.props.highlights": '"many", "one" or "none": how many points the user may highlight, many when absent; with "none" the chart is only read and gives no result'
};
var CHART_FIELDS = {
  "chart.props": "a Chart's props hold only kind, categories, series, title, valueLabel, categoryLabel, unit and highlights",
  "chart.props.categories[]": "a category holds only id and label",
  "chart.props.series[]": "a series holds only id, label and values"
};
const chartElementOf = (item, rest) => {
  const list = rest[1];
  if (!isRecord(item) || list !== "categories" && list !== "series" || !isIndex(rest[2])) {
    return;
  }
  const elements = isRecord(item.props) ? item.props[list] : undefined;
  const element = Array.isArray(elements) ? elements[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `${list === "series" ? "series" : "category"} "${id}"` : undefined;
};

// packages/contract/src/widgets/chart/widget.ts
var CHART_WIDGET = {
  type: "chart",
  noun: "a Chart",
  props: chart_props_default,
  propsProblems: chartPropsProblems,
  result: { schema: chart_result_default, shape: chartResultShape, problems: chartResultProblems },
  wording: { expected: CHART_EXPECTED, fields: CHART_FIELDS, element: chartElementOf },
  example: {
    item: {
      type: "chart",
      id: "failures",
      props: {
        kind: "bar",
        categories: [
          { id: "fix-a", label: "Fix A" },
          { id: "fix-b", label: "Fix B" },
          { id: "fix-c", label: "Fix C" }
        ],
        series: [
          { id: "fails", label: "Failures", values: [4, 9, 2] },
          { id: "reruns", label: "Reruns", values: [1, 3, null] }
        ],
        unit: "runs"
      }
    }
  },
  keys: CHART_KEYS,
  help: {
    mouse: "Click a bar, point or slice to highlight it and click it again to clear it; hover to read its value.",
    answer: "The agent receives the points you highlighted. A chart you did not touch gives no answer."
  },
  skill: {
    use: "a bar, line or pie chart the user reads and may highlight points on",
    notes: [
      "`values` holds one number or null per category, in the categories' order; at most 5 series, and a pie takes one series of at most 5 slices.",
      '`highlights` is `many` (default), `one` or `none`. The result is `points`, each `{series, category}`; an untouched Chart gives no result, and with `highlights: "none"` there is no result at all, so give the question options or another item.'
    ]
  }
};

// packages/contract/src/widgets/field-checks.ts
const requiredFailure = (props, result) => typeof props === "object" && props !== null && !Array.isArray(props) && Object.hasOwn(props, "required") && props.required === true && result === undefined ? { code: "required" } : undefined;
const requiredPropProblems = (props) => props.required !== undefined && typeof props.required !== "boolean" ? [{ path: "/required", message: "required is true or false" }] : [];

// packages/contract/src/nested-items.ts
var LAYOUT_TYPES = ["stack", "row", "group", "tabs"];
const isLayoutType = (type) => typeof type === "string" && LAYOUT_TYPES.includes(type);
const isDictionary = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const own = (record, key) => Object.hasOwn(record, key) ? record[key] : undefined;
const layoutListsOf = (item) => {
  if (!isDictionary(item) || !isLayoutType(own(item, "type")))
    return [];
  const props = own(item, "props");
  if (!isDictionary(props))
    return [];
  if (own(item, "type") !== "tabs") {
    const items = own(props, "items");
    return Array.isArray(items) ? [{ path: ["props", "items"], items }] : [];
  }
  const panels = own(props, "tabs");
  if (!Array.isArray(panels))
    return [];
  return panels.flatMap((panel, at) => {
    const items = isDictionary(panel) ? own(panel, "items") : undefined;
    return Array.isArray(items) ? [{ path: ["props", "tabs", String(at), "items"], items }] : [];
  });
};
const pushList = (stack, items, at, depth) => {
  for (let index = items.length - 1;index >= 0; index -= 1) {
    stack.push({ item: items[index], path: [...at, String(index)], depth });
  }
};
const pushChildren = (stack, { item, path, depth }) => {
  const lists = layoutListsOf(item);
  for (let at = lists.length - 1;at >= 0; at -= 1) {
    const list = lists[at];
    if (list !== undefined)
      pushList(stack, list.items, [...path, ...list.path], depth + 1);
  }
};
const nestedItemsOf = (items, at = []) => {
  const found = [];
  const stack = [];
  pushList(stack, items, at, 0);
  for (let entry = stack.pop();entry !== undefined; entry = stack.pop()) {
    found.push(entry);
    pushChildren(stack, entry);
  }
  return found;
};
// packages/contract/src/widgets/gantt/gantt-changes.json
var gantt_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:gantt-changes",
  title: "Gantt changes",
  description: "A Gantt's changes (AD-20, FR-20): set operations of the one generic diff on a task's field, its duration, its requested start or its predecessors, addressed as item.task.field (AD-13's reference syntax without brackets). null clears a requested start, a plan's requested duration, or empties the predecessors. Since output format 1.4 a plan's task may take a duration, its requested one. A Gantt never adds, removes or moves a task: a plan's tasks come from its Tree. Which field goes with which form, and value ranges, are the contract's checks.",
  type: "array",
  items: {
    $ref: "#/$defs/set"
  },
  $defs: {
    set: {
      type: "object",
      properties: {
        op: {
          const: "set"
        },
        target: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}\\.(duration|start|dependencies)$"
        },
        value: {
          anyOf: [
            {
              type: "integer",
              minimum: 1,
              maximum: 2000
            },
            {
              $ref: "urn:askboard:input:gantt-props#/$defs/fullDate"
            },
            {
              $ref: "urn:askboard:input:gantt-props#/$defs/predecessors"
            },
            {
              type: "null"
            }
          ]
        }
      },
      required: ["op", "target", "value"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/gantt/gantt-props.json
var gantt_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:gantt-props",
  title: "Gantt item props",
  description: "A Gantt's props (FR-11, FR-15): the plan's start and its tasks. Without workPackages, tasks is the Gantt's own list, in the agent's order, each with a label and a duration in whole working days. With workPackages, the ID of a Tree item whose leaves are the tasks (the Gantt plan), tasks maps a task ID to what the plan says of that task; names, durations and order come from the Tree. A task may carry a requested start, on or after which it starts, and its finish-to-start predecessors; a plan's entry may also carry a requested duration in whole working days, which wins over the one its Tree's estimates give (since input format 1.5). Which form goes with workPackages, real days and the dependents limit are the contract's checks.",
  type: "object",
  properties: {
    start: {
      $ref: "#/$defs/fullDate"
    },
    workPackages: {
      $ref: "urn:askboard:input:id"
    },
    tasks: {
      anyOf: [
        {
          $ref: "#/$defs/ownTasks"
        },
        {
          $ref: "#/$defs/planTasks"
        }
      ]
    }
  },
  required: ["start", "tasks"],
  additionalProperties: false,
  $defs: {
    fullDate: {
      description: "An RFC 3339 full-date (AD-7, Values); whether the day exists is a check.",
      type: "string",
      pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"
    },
    predecessors: {
      description: "A task's finish-to-start predecessors, by task ID, each listed once.",
      type: "array",
      maxItems: 50,
      uniqueItems: true,
      items: {
        $ref: "urn:askboard:input:id"
      }
    },
    ownTask: {
      type: "object",
      properties: {
        id: {
          $ref: "urn:askboard:input:id"
        },
        label: {
          type: "string",
          minLength: 1,
          maxLength: 200
        },
        duration: {
          type: "integer",
          minimum: 1,
          maximum: 2000
        },
        start: {
          $ref: "#/$defs/fullDate"
        },
        dependencies: {
          $ref: "#/$defs/predecessors"
        }
      },
      required: ["id", "label", "duration"],
      additionalProperties: false
    },
    ownTasks: {
      type: "array",
      maxItems: 500,
      items: {
        $ref: "#/$defs/ownTask"
      }
    },
    planEntry: {
      type: "object",
      properties: {
        duration: {
          type: "integer",
          minimum: 1,
          maximum: 2000
        },
        start: {
          $ref: "#/$defs/fullDate"
        },
        dependencies: {
          $ref: "#/$defs/predecessors"
        }
      },
      additionalProperties: false
    },
    planTasks: {
      type: "object",
      maxProperties: 500,
      propertyNames: {
        $ref: "urn:askboard:input:id"
      },
      additionalProperties: {
        $ref: "#/$defs/planEntry"
      }
    }
  }
};

// packages/contract/src/widgets/gantt/keys.ts
var GRID = "grid";
var EDITOR = "editor";
var ZOOM = "zoom";
var EDGE = "edge";
var PANEL = "panel";
var SWITCH = "switch";
var SPACE = [keyBinding(" ")];
var EDITS = { readOnly: false };
var VIEW = { readOnly: true };
var GANTT_KEYS = [
  vocabularyEntry("cursor.up", GRID, "navigation"),
  vocabularyEntry("cursor.down", GRID, "navigation"),
  vocabularyEntry("cursor.left", GRID, "navigation"),
  vocabularyEntry("cursor.right", GRID, "navigation"),
  vocabularyEntry("cursor.first", GRID, "navigation"),
  vocabularyEntry("cursor.last", GRID, "navigation"),
  vocabularyEntry("edit.start", GRID, "pointer"),
  ownEntry("gantt.clear", GRID, [keyBinding("Delete"), keyBinding("Backspace")], "pointer", EDITS),
  vocabularyEntry("edit.commit", EDITOR, "navigation"),
  vocabularyEntry("edit.cancel", EDITOR, "navigation"),
  vocabularyEntry("toolbar.previous", ZOOM, "navigation"),
  vocabularyEntry("toolbar.next", ZOOM, "navigation"),
  vocabularyEntry("toolbar.first", ZOOM, "navigation"),
  vocabularyEntry("toolbar.last", ZOOM, "navigation"),
  ownEntry("gantt.narrower", EDGE, [keyBinding("ArrowLeft")], "pointer", VIEW),
  ownEntry("gantt.wider", EDGE, [keyBinding("ArrowRight")], "pointer", VIEW),
  ownEntry("gantt.narrowerMore", EDGE, [keyBinding("ArrowLeft", "shift")], "pointer", VIEW),
  ownEntry("gantt.widerMore", EDGE, [keyBinding("ArrowRight", "shift")], "pointer", VIEW),
  ownEntry("gantt.narrowest", EDGE, [keyBinding("Home")], "pointer", VIEW),
  ownEntry("gantt.widest", EDGE, [keyBinding("End")], "pointer", VIEW),
  ownEntry("gantt.fit", EDGE, [keyBinding("Enter")], "pointer", VIEW),
  vocabularyEntry("cursor.up", PANEL, "navigation", EDITS),
  vocabularyEntry("cursor.down", PANEL, "navigation", EDITS),
  vocabularyEntry("edit.commit", PANEL, "navigation", { label: "gantt.panel.done" }),
  vocabularyEntry("edit.cancel", PANEL, "navigation"),
  ownEntry("gantt.togglePredecessor", PANEL, SPACE, "native", EDITS),
  vocabularyEntry("toolbar.previous", SWITCH, "navigation"),
  vocabularyEntry("toolbar.first", SWITCH, "navigation"),
  ownEntry("gantt.criticalPath", SWITCH, SPACE, "native", {
    readOnly: true,
    label: "gantt.critical.switch"
  })
];

// packages/contract/src/widgets/gantt/index.ts
var GANTT_MAX_TASKS = 500;
var GANTT_MAX_PREDECESSORS = 50;
var GANTT_MAX_DEPENDENTS = 50;
var GANTT_MIN_DURATION = 1;
var GANTT_MAX_DURATION = 2000;
var GANTT_LABEL_MAX_CHARS = 200;
var GANTT_FIRST_DATE = "1900-03-02";
var GANTT_LAST_DATE = "9999-12-31";
var GANTT_PLAN_ESTIMATES = /* @__PURE__ */ Object.freeze([
  "optimistic",
  "mostLikely",
  "pessimistic"
]);
var GANTT_ANSWER_DERIVED = /* @__PURE__ */ Object.freeze({
  finish: "finishDate",
  criticalPath: "critical"
});
var GANTT_SHAPE = /* @__PURE__ */ Object.freeze({ elements: "tasks" });
var GANTT_PLAN_SHAPE = /* @__PURE__ */ Object.freeze({
  elements: "tasks",
  keyed: true
});
const ganttShape = (props) => props.workPackages === undefined ? GANTT_SHAPE : GANTT_PLAN_SHAPE;

// packages/contract/src/widgets/gantt/checks.ts
const isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const daysIn = (year, month) => {
  if (month === 2)
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};
const isGanttDate = (value) => {
  const match = typeof value === "string" ? FULL_DATE.exec(value) : null;
  if (match === null)
    return false;
  const [year, month, day] = match.slice(1).map(Number);
  const real = month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
  return real && value >= GANTT_FIRST_DATE && value <= GANTT_LAST_DATE;
};
var DAYS = `a day from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
var RESERVED = `starts with ${VIEW_ID_PREFIX}, reserved for IDs the board makes`;
var PLAN_NAMES = "a plan's tasks take their names from its Tree";
const isReserved = (id) => typeof id === "string" && id.startsWith(VIEW_ID_PREFIX);
const taskFieldProblems = (task, id, path, origin) => {
  const problems = [];
  if (task.start !== undefined && typeof task.start === "string" && !isGanttDate(task.start)) {
    problems.push({
      path: `${path}/start`,
      message: `task ${id}: ${JSON.stringify(task.start)} is not ${DAYS}`
    });
  }
  if (!Array.isArray(task.dependencies))
    return problems;
  const seen = new Set;
  for (const predecessor of task.dependencies) {
    const at = `${path}/dependencies`;
    if (seen.has(predecessor)) {
      problems.push({
        path: at,
        message: `task ${id}: predecessor ${predecessor} is listed twice`
      });
    }
    seen.add(predecessor);
    if (origin === "agent" && isReserved(predecessor)) {
      problems.push({ path: at, message: `task ${id}: predecessor ${predecessor} ${RESERVED}` });
    }
  }
  return problems;
};
const dependentsProblems = (tasks) => {
  const dependents = new Map;
  for (const [, , task] of tasks) {
    if (!Array.isArray(task.dependencies))
      continue;
    for (const predecessor of new Set(task.dependencies)) {
      dependents.set(predecessor, (dependents.get(predecessor) ?? 0) + 1);
    }
  }
  const paths = new Map(tasks.map(([id, path]) => [id, path]));
  return [...dependents].filter(([, count]) => count > GANTT_MAX_DEPENDENTS).map(([id, count]) => ({
    path: paths.get(id) ?? "/tasks",
    message: `task ${id} has ${count} dependent tasks, more than the limit of ${GANTT_MAX_DEPENDENTS}`
  }));
};
const ownTaskProblems = (tasks, origin) => {
  const problems = [];
  const seen = new Set;
  const checked = [];
  tasks.forEach((task, index) => {
    if (!isRecord2(task) || typeof task.id !== "string")
      return;
    const path = `/tasks/${index}`;
    if (seen.has(task.id)) {
      problems.push({ path: `${path}/id`, message: `task ID ${task.id} is used twice` });
    }
    seen.add(task.id);
    if (origin === "agent" && isReserved(task.id)) {
      problems.push({ path: `${path}/id`, message: `task ID ${task.id} ${RESERVED}` });
    }
    problems.push(...taskFieldProblems(task, task.id, path, origin));
    checked.push([task.id, path, task]);
  });
  return [...problems, ...dependentsProblems(checked)];
};
const durationProblem = (task, value) => {
  const whole = Number.isSafeInteger(value);
  const inRange = whole && value >= GANTT_MIN_DURATION;
  if (inRange && value <= GANTT_MAX_DURATION)
    return;
  return `task ${task}: duration takes whole working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}, not ${JSON.stringify(value)}`;
};
const planEntryProblems = (entries, origin) => {
  const problems = [];
  const checked = [];
  for (const [id, entry] of Object.entries(entries)) {
    if (!isRecord2(entry))
      continue;
    const path = `/tasks/${id}`;
    if (origin === "agent" && isReserved(id)) {
      problems.push({ path, message: `task ${id} ${RESERVED}` });
    }
    if (entry.label !== undefined) {
      problems.push({ path: `${path}/label`, message: `task ${id}: ${PLAN_NAMES}` });
    }
    const requested = entry.duration === undefined ? undefined : durationProblem(id, entry.duration);
    if (requested !== undefined)
      problems.push({ path: `${path}/duration`, message: requested });
    problems.push(...taskFieldProblems(entry, id, path, origin));
    checked.push([id, path, entry]);
  }
  return [...problems, ...dependentsProblems(checked)];
};
const ganttPropsProblems = (props, origin) => {
  if (!isRecord2(props))
    return [];
  const problems = [];
  if (props.start !== undefined && typeof props.start === "string" && !isGanttDate(props.start)) {
    problems.push({ path: "/start", message: `${JSON.stringify(props.start)} is not ${DAYS}` });
  }
  const isPlan = props.workPackages !== undefined;
  if (isPlan && Array.isArray(props.tasks)) {
    problems.push({
      path: "/tasks",
      message: "a plan's tasks are a map by task ID, its Tree giving their names and order"
    });
  } else if (!isPlan && isRecord2(props.tasks)) {
    problems.push({ path: "/tasks", message: "a Gantt without workPackages lists its tasks" });
  } else if (Array.isArray(props.tasks)) {
    problems.push(...ownTaskProblems(props.tasks, origin));
  } else if (isRecord2(props.tasks)) {
    problems.push(...planEntryProblems(props.tasks, origin));
  }
  return problems;
};
const ganttPlanLinkProblems = (gantt, question) => {
  if (!isRecord2(gantt) || !isRecord2(gantt.props))
    return [];
  const name = gantt.props.workPackages;
  if (typeof name !== "string")
    return [];
  const refused = (message) => [
    { path: "/workPackages", message: `plan ${String(gantt.id)}: ${message}` }
  ];
  const props = isRecord2(question) && isRecord2(question.props) ? question.props : {};
  const items = Array.isArray(props.items) ? props.items : [];
  const item = nestedItemsOf(items).find(({ item: candidate }) => isRecord2(candidate) && candidate.id === name)?.item;
  if (!isRecord2(item))
    return refused(`its work packages ${name} name no item of its question`);
  if (item.type !== "tree") {
    return refused(`its work packages ${name} name a ${String(item.type)}, not a Tree`);
  }
  const columns = isRecord2(item.props) && Array.isArray(item.props.columns) ? item.props.columns : [];
  const declares = (field) => columns.some((column) => isRecord2(column) && column.field === field && column.type === "number");
  const missing = GANTT_PLAN_ESTIMATES.filter((field) => !declares(field));
  if (missing.length === 0)
    return [];
  return refused(`the Tree ${name} has no number column ${missing.join(", ")}: a plan's durations follow its estimates`);
};
var FIELDS = new Set(["duration", "start", "dependencies"]);
var NOT_SET = new Set(["add", "remove", "move"]);

// packages/contract/src/widgets/shared/atoms.ts
var ATOM_LABEL_MAX_CHARS = 200;
var ATOM_DESCRIPTION_MAX_CHARS = 1000;
var ATOM_NUMBER_BOUND = 1000000000000000;
var ATOM_UNIT_MAX_CHARS = 20;
const codePointCount = (text) => [...text].length;

// packages/contract/src/widgets/date-field/checks.ts
var KEYS = ["label", "description", "min", "max", "required"];
var DAYS2 = `a day that exists, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
const textWithin = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const dateFieldPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a DateField's props are an object {label, ...}" }];
  }
  const problems = Object.keys(props).filter((key) => !KEYS.includes(key)).map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
  if (!textWithin(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (props.description !== undefined && !textWithin(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  for (const key of ["min", "max"]) {
    if (props[key] !== undefined && !isGanttDate(props[key])) {
      at(`/${key}`, `${key} is ${DAYS2}`);
    }
  }
  if (isGanttDate(props.min) && isGanttDate(props.max) && props.max < props.min) {
    at("/max", `max ${props.max} is before min ${props.min}`);
  }
  return problems;
};
const dateFieldResultProblems = (result, props) => {
  if (!isRecord(props) || dateFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no DateField's, so its result cannot be checked"
      }
    ];
  }
  if (typeof result !== "string")
    return [];
  const at = (message) => [{ path: "/", message }];
  if (!isGanttDate(result))
    return at(`${JSON.stringify(result)} is not ${DAYS2}`);
  const { min, max } = props;
  if (min !== undefined && result < min)
    return at(`${result} is before the field's first day ${min}`);
  if (max !== undefined && result > max)
    return at(`${result} is after the field's last day ${max}`);
  return [];
};
const dateFieldResultShape = (result) => typeof result === "string" && /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(result);
const dateFieldFieldCheck = (result, props) => requiredFailure(props, result);
// packages/contract/src/widgets/date-field/date-field-props.json
var date_field_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:date-field-props",
  title: "DateField props",
  description: "A DateField item's props (FR-13, atoms design decision 1): a label of 1 to 200 characters, an optional description of 1 to 1000 and optional min and max, the Gantt's full-dates. That the days exist within the Gantt's days and that max is not before min are checks of dateFieldPropsProblems. `required` since form-widget. In the input format since atoms.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    min: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" },
    max: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" },
    required: { type: "boolean" }
  },
  required: ["label"],
  additionalProperties: false
};
// packages/contract/src/widgets/date-field/date-field-result.json
var date_field_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:date-field-result",
  title: "DateField result",
  description: "A DateField's result (FR-13, FR-18, atoms design decision 1): an RFC 3339 full-date. That the day exists, lies within the Gantt's days and within the item's min and max are checks of the type against the item's props. In the output format since atoms.",
  type: "string",
  pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"
};

// packages/contract/src/widgets/date-field/wording.ts
var DAYS3 = `a full-date from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
var DATE_FIELD_EXPECTED = {
  "date-field.props": "a DateField's props {label, description?, required?, min?, max?}",
  "date-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "date-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "date-field.props.required": "true, for a field that must hold a value before the question is answered",
  "date-field.props.min": `${DAYS3}, the earliest day`,
  "date-field.props.max": `${DAYS3}, the latest day, not before min`
};
var DATE_FIELD_FIELDS = {
  "date-field.props": "a DateField's props hold only label, description, required, min and max"
};

// packages/contract/src/widgets/date-field/widget.ts
var DATE_FIELD_WIDGET = {
  type: "date-field",
  noun: "a DateField",
  props: date_field_props_default,
  propsProblems: dateFieldPropsProblems,
  fieldCheck: dateFieldFieldCheck,
  result: {
    schema: date_field_result_default,
    shape: dateFieldResultShape,
    problems: dateFieldResultProblems
  },
  wording: { expected: DATE_FIELD_EXPECTED, fields: DATE_FIELD_FIELDS },
  example: {
    item: {
      type: "date-field",
      id: "start",
      props: { label: "Start date", min: "2026-01-01" }
    }
  },
  help: {
    mouse: "Type a date, or open the calendar and click a day.",
    answer: "The agent receives the day you chose."
  },
  skill: {
    use: "a calendar day the user types or picks, optionally within a range",
    notes: [
      "`min` and `max` are full-dates (`2026-03-02`) that bound the days offered. The result is a full-date."
    ]
  }
};

// packages/contract/src/widgets/divider/checks.ts
const dividerPropsProblems = (props) => {
  if (!isRecord(props))
    return [{ path: "/", message: "a Divider's props are an empty object {}" }];
  return Object.keys(props).map((key) => ({
    path: `/${key}`,
    message: `unknown field "${key}"`
  }));
};
// packages/contract/src/widgets/divider/divider-props.json
var divider_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:divider-props",
  title: "Divider props",
  description: "A Divider item's props (FR-13, atoms design decision 1): none. It separates the items of a question and gives no result. In the input format since atoms.",
  type: "object",
  properties: {},
  additionalProperties: false
};

// packages/contract/src/widgets/divider/wording.ts
var DIVIDER_EXPECTED = {
  "divider.props": "a Divider's props, an empty object {}"
};
var DIVIDER_FIELDS = {
  "divider.props": "a Divider's props hold nothing"
};

// packages/contract/src/widgets/divider/widget.ts
var DIVIDER_WIDGET = {
  type: "divider",
  noun: "a Divider",
  props: divider_props_default,
  propsProblems: dividerPropsProblems,
  wording: { expected: DIVIDER_EXPECTED, fields: DIVIDER_FIELDS },
  example: { item: { type: "divider", id: "rule", props: {} } },
  help: {
    mouse: "It is a line between two items: there is nothing to click or type.",
    answer: "Nothing: a divider gives no answer."
  },
  skill: { use: "a rule that separates the items of a question; its props are empty" }
};

// packages/contract/src/push/constants.ts
var POLL_INTERVAL_MS = 1000;
var RECORD_HOLD_MS = 30 * 60 * 1000;
var CLAUDE_CODE_CLIENT_NAME = "claude-code";
var LOCAL_API_MAX_BYTES = 1024 * 1024;
var TEAMMATE_NAME_MAX_CHARS = 256;
var SESSION_TOKEN_HEADER = "X-AskBoard-Session";
var NOTICE_TEXT_MAX_CHARS = 120;
var LOCAL_API_HOST = "askboard";
var LOCAL_API_ROUTES = {
  records: { method: "POST", path: "/v1/records" },
  stop: { method: "POST", path: "/v1/stop" },
  rule: { method: "GET", path: "/v1/rule" },
  notice: { method: "GET", path: "/v1/notice" },
  modHello: { method: "POST", path: "/v1/mod/hello" },
  modTurn: { method: "POST", path: "/v1/mod/turn" },
  poll: { method: "GET", path: "/v1/mod/poll" },
  delivered: { method: "POST", path: "/v1/mod/delivered" }
};
var LOCAL_API_QUERY = { askId: "askId", seq: "seq" };
const query = (parameters) => parameters.map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`).join("&");
const pollPath = (continuation) => {
  const { path } = LOCAL_API_ROUTES.poll;
  if (continuation === undefined)
    return path;
  const { askId, seq } = continuation;
  return `${path}?${query([
    [LOCAL_API_QUERY.askId, askId],
    [LOCAL_API_QUERY.seq, seq]
  ])}`;
};

// packages/contract/src/push/notice-text.ts
var ELLIPSIS = "…";
var BIDI = new Set([
  1564,
  8206,
  8207,
  8234,
  8235,
  8236,
  8237,
  8238,
  8294,
  8295,
  8296,
  8297
]);
const isEscapedCodePoint = (code) => code < 32 || code >= 127 && code <= 159 || BIDI.has(code);
const shown = (point) => {
  const code = point.codePointAt(0) ?? 0;
  return isEscapedCodePoint(code) ? `\\u${code.toString(16).toUpperCase().padStart(4, "0")}` : point;
};
const sizeOf = (unit) => unit.length > 2 ? unit.length : 1;
const agentTextRuns = (text) => {
  const runs = [];
  for (const unit of Array.from(text, shown)) {
    const escaped = unit.length > 2;
    const last = runs.at(-1);
    if (!escaped && last !== undefined && !last.escape) {
      runs[runs.length - 1] = { text: last.text + unit, escape: false };
    } else {
      runs.push({ text: unit, escape: escaped });
    }
  }
  return runs;
};
const agentTextPiece = (text, max = NOTICE_TEXT_MAX_CHARS) => {
  const units = Array.from(text, shown);
  const total = units.reduce((sum, unit) => sum + sizeOf(unit), 0);
  if (total <= max)
    return units.join("");
  let kept = "";
  let length = 0;
  for (const unit of units) {
    if (length + sizeOf(unit) > max - 1)
      break;
    kept += unit;
    length += sizeOf(unit);
  }
  return `${kept}${ELLIPSIS}`;
};

// packages/contract/src/lifecycle-limits.ts
var ANNOTATION_MAX_CHARS = 2000;
var ANNOTATION_REPLACEMENT_MAX_CHARS = 4000;
var JSON_MAX_DEPTH = 64;
var DRAFT_RECORD_OWN_LEVELS = 4;
var DRAFT_RECORD_MAX_DEPTH = JSON_MAX_DEPTH + DRAFT_RECORD_OWN_LEVELS;

// packages/contract/src/widgets/text/constants.ts
var TEXT_MAX_CHARS = 1e4;
var TEXT_FORMATS = /* @__PURE__ */ Object.freeze(["plain", "markdown"]);

// packages/contract/src/widgets/document-review/constants.ts
var DOCUMENT_REVIEW_MAX_CHARS = TEXT_MAX_CHARS;
var DOCUMENT_REVIEW_TITLE_MAX_CHARS = 120;
var DOCUMENT_REVIEW_ANNOTATIONS_MAX = 100;

// packages/contract/src/widgets/document-review/checks.ts
var LINE_FEED = 10;
var TAB = 9;
const refusedCharacter = (markdown) => {
  for (const point of markdown) {
    const code = point.codePointAt(0) ?? 0;
    if (code !== LINE_FEED && code !== TAB && isEscapedCodePoint(code)) {
      return agentTextRuns(point)[0]?.text;
    }
  }
  return;
};
const markdownProblems = (markdown) => {
  if (typeof markdown !== "string") {
    return [{ path: "/markdown", message: "the markdown is a text of 1 or more characters" }];
  }
  const count = codePointCount(markdown);
  if (count < 1 || count > DOCUMENT_REVIEW_MAX_CHARS) {
    return [
      {
        path: "/markdown",
        message: `the markdown has ${count} characters, and a Document review holds 1 to ${DOCUMENT_REVIEW_MAX_CHARS}`
      }
    ];
  }
  const refused = refusedCharacter(markdown);
  return refused === undefined ? [] : [
    {
      path: "/markdown",
      message: `the markdown holds the control character ${refused}, which the board cannot show as it stands: only line feeds and tabs are allowed`
    }
  ];
};
const titleProblems = (title) => {
  if (title === undefined)
    return [];
  if (typeof title !== "string") {
    return [{ path: "/title", message: "the title is a text of 1 or more characters" }];
  }
  const count = codePointCount(title);
  return count < 1 || count > DOCUMENT_REVIEW_TITLE_MAX_CHARS ? [
    {
      path: "/title",
      message: `the title has ${count} characters, and a title holds 1 to ${DOCUMENT_REVIEW_TITLE_MAX_CHARS}`
    }
  ] : [];
};
const documentReviewPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Document review's props are an object {markdown, title?}" }];
  }
  const unknown = Object.keys(props).filter((key) => key !== "markdown" && key !== "title").map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  return [...unknown, ...markdownProblems(props.markdown), ...titleProblems(props.title)];
};
// packages/contract/src/widgets/document-review/document-review-props.json
var document_review_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:document-review-props",
  title: "Document review props",
  description: "A Document review item's props (FR-11, document-review design decision 1): the document as Markdown, 1 to 10000 characters, and an optional title of 1 to 120 characters. The board shows the document as data and never as markup; the user comments on passages of it and suggests edits. documentReviewPropsProblems adds what a schema cannot say: no control or bidirectional character in the document but line feeds and tabs. In the input format since document-review.",
  type: "object",
  properties: {
    markdown: { type: "string", minLength: 1, maxLength: 1e4 },
    title: { type: "string", minLength: 1, maxLength: 120 }
  },
  required: ["markdown"],
  additionalProperties: false
};
// packages/contract/src/widgets/document-review/document-review-result.json
var document_review_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:document-review-result",
  title: "Document review result",
  description: "A Document review's result (FR-11, FR-18, document-review design decision 3): 1 to 100 annotations the user made, each the output format's annotation narrowed to a quote selector: a comment (body.text), a suggested edit (body.replacement, which replaces the quoted text, an empty one deleting it) or both. That each ID starts with u- and is unique, that exact holds a character other than white space and is no longer than the item's document, that exact, prefix and suffix hold no character the document refuses, and that a replacement differs from its exact are checks of the type against the item's props. That a quote occurs once in the document's text is the board's: only the view renders the document. Never empty. In the output format since document-review.",
  type: "object",
  properties: {
    annotations: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        allOf: [
          { $ref: "urn:askboard:output:annotation" },
          {
            type: "object",
            properties: {
              target: {
                type: "object",
                properties: {
                  selector: { $ref: "urn:askboard:output:annotation#/$defs/quote" }
                },
                required: ["selector"]
              }
            },
            required: ["target"]
          }
        ]
      }
    }
  },
  required: ["annotations"],
  additionalProperties: false
};

// packages/contract/src/widgets/document-review/result-checks.ts
var ID_MAX_CHARS = 64;
var CONTEXT_MAX_CHARS = 200;
const holds = (text, min, max) => {
  if (typeof text !== "string")
    return false;
  let count = 0;
  for (const _ of text) {
    count += 1;
    if (count > max)
      return false;
  }
  return count >= min;
};
const idCharacter = (code) => code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95 || code === 45;
const isId = (value) => typeof value === "string" && value.length >= 1 && value.length <= ID_MAX_CHARS && [...value].every((character) => idCharacter(character.codePointAt(0) ?? 0));
const hasKeys = (value, required, allowed) => Object.keys(value).every((key) => allowed.includes(key)) && required.every((key) => Object.hasOwn(value, key));
const isQuote = (selector) => isRecord(selector) && hasKeys(selector, ["type", "exact"], ["type", "exact", "prefix", "suffix"]) && selector.type === "quote" && holds(selector.exact, 1, ANNOTATION_MAX_CHARS) && (selector.prefix === undefined || holds(selector.prefix, 0, CONTEXT_MAX_CHARS)) && (selector.suffix === undefined || holds(selector.suffix, 0, CONTEXT_MAX_CHARS));
const isBody = (body) => isRecord(body) && Object.keys(body).length >= 1 && hasKeys(body, [], ["text", "replacement"]) && (body.text === undefined || holds(body.text, 1, ANNOTATION_MAX_CHARS)) && (body.replacement === undefined || holds(body.replacement, 0, ANNOTATION_REPLACEMENT_MAX_CHARS));
const isAnnotation = (annotation) => isRecord(annotation) && hasKeys(annotation, ["id", "target", "body"], ["id", "target", "body"]) && isId(annotation.id) && isRecord(annotation.target) && hasKeys(annotation.target, ["selector"], ["selector"]) && isQuote(annotation.target.selector) && isBody(annotation.body);
const documentReviewResultShape = (result) => {
  if (!isRecord(result))
    return false;
  const keys = Object.keys(result);
  const { annotations } = result;
  return keys.length === 1 && keys[0] === "annotations" && Array.isArray(annotations) && annotations.length >= 1 && annotations.length <= DOCUMENT_REVIEW_ANNOTATIONS_MAX && annotations.every(isAnnotation);
};
const named = (id) => `annotation ${JSON.stringify(String(id).slice(0, ID_MAX_CHARS))}`;
const annotationProblems = (annotation, index, length, seen) => {
  if (!isRecord(annotation) || typeof annotation.id !== "string")
    return [];
  const { id } = annotation;
  const who = named(id);
  const at = (field, message) => ({
    path: `/annotations/${index}${field}`,
    message: `${who} ${message}`
  });
  const problems = [];
  if (!id.startsWith(VIEW_ID_PREFIX)) {
    problems.push(at("/id", `has an ID the board did not make: the board's IDs start with ${VIEW_ID_PREFIX}`));
  }
  if (seen.has(id))
    problems.push(at("/id", "is named twice: each annotation has an ID of its own"));
  seen.add(id);
  const selector = isRecord(annotation.target) ? annotation.target.selector : undefined;
  if (!isRecord(selector))
    return problems;
  if (selector.type !== "quote")
    return problems;
  for (const field of ["exact", "prefix", "suffix"]) {
    const value = selector[field];
    const refused = typeof value === "string" ? refusedCharacter(value) : undefined;
    if (refused !== undefined) {
      problems.push(at(`/target/selector/${field}`, `holds the control character ${refused}, which no document holds`));
    }
  }
  const { exact } = selector;
  if (typeof exact === "string") {
    if (exact.trim() === "") {
      problems.push(at("/target/selector/exact", "quotes white space only"));
    } else if (length >= 0 && !holds(exact, 0, length)) {
      problems.push(at("/target/selector/exact", `quotes more than the document holds: it is longer than the document`));
    }
  }
  const body = annotation.body;
  if (isRecord(body) && typeof body.replacement === "string" && body.replacement === exact) {
    problems.push(at("/body/replacement", "suggests the passage as it is: the replacement changes nothing"));
  }
  return problems;
};
const documentLength = (props) => {
  const markdown = isRecord(props) ? props.markdown : undefined;
  if (typeof markdown !== "string")
    return -1;
  let count = 0;
  for (const _ of markdown)
    count += 1;
  return count;
};
const documentReviewResultProblems = (result, props) => {
  const length = documentLength(props);
  if (length < 0) {
    return [
      {
        path: "/",
        message: "the item's props are no Document review's, so its annotations cannot be checked"
      }
    ];
  }
  const annotations = isRecord(result) && Array.isArray(result.annotations) ? result.annotations : [];
  const seen = new Set;
  return annotations.flatMap((annotation, index) => annotationProblems(annotation, index, length, seen));
};

// packages/contract/src/widgets/document-review/wording.ts
var DOCUMENT_REVIEW_EXPECTED = {
  "document-review.props": "a Document review's props {markdown, title?}",
  "document-review.props.markdown": `${text(DOCUMENT_REVIEW_MAX_CHARS)} of Markdown, with no control or bidirectional character but line feeds and tabs`,
  "document-review.props.title": text(DOCUMENT_REVIEW_TITLE_MAX_CHARS)
};
var DOCUMENT_REVIEW_FIELDS = {
  "document-review.props": "a Document review's props hold only markdown and title"
};

// packages/contract/src/widgets/document-review/widget.ts
var DOCUMENT_REVIEW_WIDGET = {
  type: "document-review",
  noun: "a Document review",
  props: document_review_props_default,
  propsProblems: documentReviewPropsProblems,
  result: {
    schema: document_review_result_default,
    shape: documentReviewResultShape,
    problems: documentReviewResultProblems
  },
  wording: { expected: DOCUMENT_REVIEW_EXPECTED, fields: DOCUMENT_REVIEW_FIELDS },
  example: {
    item: {
      type: "document-review",
      id: "release-notes",
      props: {
        markdown: `## Release 0.2

The board **remembers** drafts.`,
        title: "Release notes"
      }
    }
  },
  help: {
    mouse: "Select a passage of the document and press Comment or Suggest edit; click a pin to read, edit or delete its note.",
    answer: "The agent receives each comment and suggested edit with the passage it is about."
  },
  skill: {
    use: "a Markdown document the user comments on and suggests edits to",
    notes: [
      "`markdown` is the document, at most 10,000 characters with no control or bidirectional formatting character (such as U+200E, U+200F, U+061C) but line feeds and tabs; send a longer one as one item per section. `title` is optional.",
      "The result is `annotations`, each a `quote` selector (`exact`, `prefix`, `suffix`) and a body with `text` (a comment), `replacement` (a suggested edit) or both. A quote is the text as the board shows it, Markdown marks removed.",
      "`replacement` replaces `exact`, and an empty one deletes it. If you cannot find a quote in your Markdown, ask the user; never guess.",
      "An untouched item gives no result, so give the question options or another widget that answers."
    ]
  }
};

// packages/contract/src/widgets/gantt/wording.ts
var DAY = "a day YYYY-MM-DD";
var TASK_ID = `${ID_SHAPE}, the ID of a task`;
var PREDECESSORS = `a list of at most ${GANTT_MAX_PREDECESSORS} task IDs, each once: the task's finish-to-start predecessors`;
var DURATION = `a whole number of working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}`;
var GANTT_EXPECTED = {
  "gantt.props": "a Gantt's props {start, tasks, workPackages?}",
  "gantt.props.start": `${DAY}: the day the plan starts`,
  "gantt.props.workPackages": "the ID of the Tree of the same question whose leaves are the tasks",
  "gantt.props.tasks": `a list of at most ${GANTT_MAX_TASKS} tasks {id, label, duration, start?, dependencies?}, or with workPackages a map from task ID to {duration?, start?, dependencies?}`,
  "gantt.props.tasks[]": "a task {id, label, duration, start?, dependencies?}",
  "gantt.props.tasks[].id": `${TASK_ID}, unique in the Gantt`,
  "gantt.props.tasks[].label": text(GANTT_LABEL_MAX_CHARS),
  "gantt.props.tasks[].duration": DURATION,
  "gantt.props.tasks[].start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks[].dependencies": PREDECESSORS,
  "gantt.props.tasks[].dependencies[]": TASK_ID,
  "gantt.props.tasks.{task}": "what the plan says of the task {duration?, start?, dependencies?}",
  "gantt.props.tasks.{task}.duration": `${DURATION}, which wins over the one the Tree's estimates give`,
  "gantt.props.tasks.{task}.start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks.{task}.dependencies": PREDECESSORS,
  "gantt.props.tasks.{task}.dependencies[]": TASK_ID
};
var GANTT_FIELDS = {
  "gantt.props": "a Gantt's props hold only start, workPackages and tasks",
  "gantt.props.tasks[]": "a task holds only id, label, duration, start and dependencies",
  "gantt.props.tasks.{task}": "a plan's task holds only duration, start and dependencies"
};
const ganttRest = (rest) => rest[1] === "tasks" && rest.length > 2 && !isIndex(rest[2]) ? [rest[0], "tasks", "{task}", ...rest.slice(3)] : rest;
const ganttElementOf = (item, rest) => {
  if (!isRecord(item) || rest[1] !== "tasks")
    return;
  if (!isIndex(rest[2]))
    return `task "${rest[2]}"`;
  const tasks = isRecord(item.props) ? item.props.tasks : undefined;
  const task = Array.isArray(tasks) ? tasks[Number(rest[2])] : undefined;
  return isRecord(task) && typeof task.id === "string" ? `task "${task.id}"` : undefined;
};
const valueAt = (value, segments) => segments.reduce((node, segment) => typeof node === "object" && node !== null ? node[segment] : undefined, value);
var TASKS = "/props/tasks";
const ganttSchemaErrors = (errors, value) => errors.filter((error) => {
  const { instancePath, keyword } = error;
  if (!instancePath.endsWith(TASKS) || keyword !== "anyOf" && keyword !== "type")
    return true;
  const item = valueAt(value, segmentsOf(instancePath.slice(0, -TASKS.length)));
  if (typeof item !== "object" || item === null || item.type !== "gantt") {
    return true;
  }
  const tasks = valueAt(item, ["props", "tasks"]);
  return keyword === "anyOf" && (typeof tasks !== "object" || tasks === null);
});

// packages/contract/src/widgets/gantt/widget.ts
const derivedProblem = (rest) => {
  const declared = Object.keys(GANTT_ANSWER_DERIVED);
  return rest.length === 1 && declared.includes(rest[0] ?? "") ? undefined : `a Gantt declares ${declared.join(" and ")}`;
};
var GANTT_WIDGET = {
  type: "gantt",
  noun: "a Gantt",
  props: gantt_props_default,
  propsProblems: ganttPropsProblems,
  checksInvalidProps: true,
  itemProblems: ganttPlanLinkProblems,
  edits: {
    changes: gantt_changes_default,
    shape: (props) => ganttShape(typeof props === "object" && props !== null ? props : {})
  },
  derived: {
    describe: `the plan's ${Object.keys(GANTT_ANSWER_DERIVED).join(" and ")}`,
    problem: derivedProblem
  },
  wording: {
    expected: GANTT_EXPECTED,
    fields: GANTT_FIELDS,
    rest: ganttRest,
    element: ganttElementOf,
    schemaErrors: ganttSchemaErrors
  },
  example: {
    item: {
      type: "gantt",
      id: "plan",
      props: { start: "2026-01-05", tasks: [{ id: "build", label: "Build", duration: 5 }] }
    }
  },
  keys: GANTT_KEYS,
  help: {
    mouse: "Click a start, duration or dependencies cell to edit it, drag a bar to move it or its end to resize it (Escape cancels a drag), drag the edge of the Task column to resize it, and pick Day, Week or Month to zoom a plan.",
    answer: "The agent receives the starts, durations and dependencies you changed; the dates and the critical path are worked out from them."
  },
  skill: {
    use: "a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed",
    notes: [
      "Without `workPackages`, `tasks` is a list of tasks, each with its label and duration. With `workPackages`, the ID of a Tree item in the same question whose leaves are the tasks, `tasks` maps a leaf ID to its requested `duration`, `start` or `dependencies`."
    ]
  }
};

// packages/contract/src/widgets/shared/layouts.ts
var LAYOUT_ITEM_DEFINITION = "layoutItem";
var LAYOUT_ITEM_REF = `urn:askboard:input:question-props#/$defs/${LAYOUT_ITEM_DEFINITION}`;
var LAYOUT_CHILD_TYPE = "the type of an atom, a widget or a layout; an excerpt, a reference, an image or a molecule reference belongs in the question's own items, outside layouts";
var LAYOUT_CHILD_ITEM = "an item {type, id, props}: an atom, a widget or a layout";
var LAYOUT_CHILD_FIELDS = "an item holds only type, id and props";
const noPropsProblems = () => [];
// packages/contract/src/widgets/group/group-props.json
var group_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:group-props",
  title: "Group props",
  description: "A Group item's props (FR-13, layouts design decision 1): a title, an optional description and at least one item, shown as one titled group. Each item is an atom, a widget or a layout as the input format writes it. A Group gives no result. In the input format since layouts.",
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    items: {
      type: "array",
      minItems: 1,
      items: { $ref: "urn:askboard:input:question-props#/$defs/layoutItem" }
    }
  },
  required: ["title", "items"],
  additionalProperties: false
};

// packages/contract/src/widgets/group/constants.ts
var GROUP_TITLE_MAX_CHARS = 200;
var GROUP_DESCRIPTION_MAX_CHARS = 1000;

// packages/contract/src/widgets/group/wording.ts
var GROUP_EXPECTED = {
  "group.props": "a Group's props {title, description?, items}",
  "group.props.title": text(GROUP_TITLE_MAX_CHARS),
  "group.props.description": text(GROUP_DESCRIPTION_MAX_CHARS),
  "group.props.items": "a non-empty list of the items the group holds",
  "group.props.items[]": LAYOUT_CHILD_ITEM,
  "group.props.items[].type": LAYOUT_CHILD_TYPE
};
var GROUP_FIELDS = {
  "group.props": "a Group's props hold only title, description and items",
  "group.props.items[]": LAYOUT_CHILD_FIELDS
};

// packages/contract/src/widgets/group/widget.ts
var GROUP_WIDGET = {
  type: "group",
  noun: "a Group",
  props: group_props_default,
  propsProblems: noPropsProblems,
  wording: { expected: GROUP_EXPECTED, fields: GROUP_FIELDS },
  example: {
    item: {
      type: "group",
      id: "arrange-group",
      props: {
        title: "Contact",
        description: "How we reach you about this request.",
        items: [{ type: "text-field", id: "arrange-group-phone", props: { label: "Phone" } }]
      }
    }
  },
  help: {
    mouse: "It frames related items under a title: use the items inside it.",
    answer: "Nothing of its own: each item in the group gives its own answer."
  },
  skill: {
    use: "a titled box around related items, read as one group",
    notes: [
      "`title` names the group for the user and for assistive technology; `description` is optional. `items` hold atoms, widgets and other layouts."
    ]
  }
};

// packages/contract/src/widgets/kanban/checks.ts
const entriesOf = (props, key, noun) => {
  const list = props[key];
  if (!Array.isArray(list))
    return [];
  return list.flatMap((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    return typeof id === "string" ? [{ id, path: `/${key}/${index}`, element: `${noun} "${id}"` }] : [];
  });
};
const kanbanPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Kanban's props are an object {columns, cards}" }];
  }
  const columns = entriesOf(props, "columns", "column");
  const cards = entriesOf(props, "cards", "card");
  const problems = [];
  const seen = new Set;
  for (const { id, path, element } of [...columns, ...cards]) {
    if (seen.has(id)) {
      problems.push({
        path: `${path}/id`,
        message: `the ID "${id}" is held twice: each column and card of a Kanban has an ID of its own (${element})`
      });
    }
    seen.add(id);
  }
  const held = new Set(columns.map(({ id }) => id));
  const cardList = Array.isArray(props.cards) ? props.cards : [];
  cardList.forEach((card, index) => {
    const column = isRecord(card) ? card.column : undefined;
    const id = isRecord(card) ? card.id : undefined;
    if (typeof column !== "string" || held.has(column))
      return;
    problems.push({
      path: `/cards/${index}/column`,
      message: `card "${String(id)}" names the column "${column}", which the item does not hold`
    });
  });
  return problems;
};

// packages/contract/src/widgets/kanban/constants.ts
var KANBAN_MIN_COLUMNS = 2;
var KANBAN_MAX_COLUMNS = 12;
var KANBAN_MIN_CARDS = 1;
var KANBAN_MAX_CARDS = 200;
var KANBAN_COLUMN_LABEL_MAX_CHARS = 60;
var KANBAN_CARD_LABEL_MAX_CHARS = 200;
var KANBAN_CARD_DESCRIPTION_MAX_CHARS = 500;
var KANBAN_SHAPE = /* @__PURE__ */ Object.freeze({ elements: "cards" });
// packages/contract/src/widgets/kanban/kanban-changes.json
var kanban_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:kanban-changes",
  title: "Kanban changes",
  description: "A Kanban's changes (AD-20, FR-20, latex-kanban-timeline design decision 4): set operations of the one generic diff on a card's column, addressed as item.card.column (AD-13's reference syntax without brackets), the value the ID of the column the card moved to. A Kanban never adds, removes or moves a card, edits a label or a description, or changes a column, so a card's place within a column is no change. In the output format since latex-kanban-timeline.",
  type: "array",
  items: { $ref: "#/$defs/set" },
  $defs: {
    set: {
      type: "object",
      properties: {
        op: { const: "set" },
        target: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}\\.column$"
        },
        value: { $ref: "urn:askboard:input:id" }
      },
      required: ["op", "target", "value"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/kanban/kanban-props.json
var kanban_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:kanban-props",
  title: "Kanban props",
  description: "A Kanban item's props (FR-11, latex-kanban-timeline design decision 4): 2 to 12 columns and 1 to 200 cards, each card naming its column by ID. That the IDs are unique within the item and that each card's column is one of the item's columns are checked by kanbanPropsProblems. In the input format since latex-kanban-timeline.",
  type: "object",
  properties: {
    columns: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: { $ref: "#/$defs/column" }
    },
    cards: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: { $ref: "#/$defs/card" }
    }
  },
  required: ["columns", "cards"],
  additionalProperties: false,
  $defs: {
    column: {
      description: "A column: its ID, unique in the item, and its label.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 60 }
      },
      required: ["id", "label"],
      additionalProperties: false
    },
    card: {
      description: "A card: its ID, unique in the item, its label, an optional description and the ID of its column.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", minLength: 1, maxLength: 500 },
        column: { $ref: "urn:askboard:input:id" }
      },
      required: ["id", "label", "column"],
      additionalProperties: false
    }
  }
};

// packages/contract/src/widgets/kanban/keys.ts
var BOARD = "board";
var TOOLBAR = "toolbar";
var KANBAN_KEYS = [
  vocabularyEntry("cursor.up", BOARD, "navigation"),
  vocabularyEntry("cursor.down", BOARD, "navigation"),
  vocabularyEntry("cursor.left", BOARD, "navigation"),
  vocabularyEntry("cursor.right", BOARD, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation", { readOnly: false }),
  ownEntry("kanban.moveTo", TOOLBAR, [], "menu", { readOnly: false, label: "kanban.moveTo" })
];

// packages/contract/src/widgets/kanban/wording.ts
var KANBAN_EXPECTED = {
  "kanban.props": "a Kanban's props {columns, cards}",
  "kanban.props.columns": `a list of ${KANBAN_MIN_COLUMNS} to ${KANBAN_MAX_COLUMNS} columns, each {id, label}`,
  "kanban.props.columns[]": "a column {id, label}",
  "kanban.props.columns[].id": `${ID_SHAPE}, unique among the Kanban's columns and cards`,
  "kanban.props.columns[].label": text(KANBAN_COLUMN_LABEL_MAX_CHARS),
  "kanban.props.cards": `a list of ${KANBAN_MIN_CARDS} to ${KANBAN_MAX_CARDS} cards, each {id, label, description?, column}`,
  "kanban.props.cards[]": "a card {id, label, description?, column}",
  "kanban.props.cards[].id": `${ID_SHAPE}, unique among the Kanban's columns and cards`,
  "kanban.props.cards[].label": text(KANBAN_CARD_LABEL_MAX_CHARS),
  "kanban.props.cards[].description": text(KANBAN_CARD_DESCRIPTION_MAX_CHARS),
  "kanban.props.cards[].column": `${ID_SHAPE}, the ID of one of the Kanban's columns`
};
var KANBAN_FIELDS = {
  "kanban.props": "a Kanban's props hold only columns and cards",
  "kanban.props.columns[]": "a column holds only id and label",
  "kanban.props.cards[]": "a card holds only id, label, description and column"
};
const kanbanElementOf = (item, rest) => {
  const key = rest[1];
  if (!isRecord(item) || key !== "cards" && key !== "columns" || !isIndex(rest[2])) {
    return;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `${key === "cards" ? "card" : "column"} "${id}"` : undefined;
};

// packages/contract/src/widgets/kanban/widget.ts
var KANBAN_WIDGET = {
  type: "kanban",
  noun: "a Kanban",
  props: kanban_props_default,
  propsProblems: kanbanPropsProblems,
  edits: { changes: kanban_changes_default, shape: () => KANBAN_SHAPE },
  wording: { expected: KANBAN_EXPECTED, fields: KANBAN_FIELDS, element: kanbanElementOf },
  example: {
    item: {
      type: "kanban",
      id: "tickets",
      props: {
        columns: [
          { id: "todo", label: "To do" },
          { id: "doing", label: "Doing" },
          { id: "done", label: "Done" }
        ],
        cards: [
          { id: "fix-login", label: "Fix the login redirect", column: "todo" },
          { id: "write-docs", label: "Write the guide", column: "doing" },
          { id: "release-notes", label: "Release notes", column: "done" }
        ]
      }
    }
  },
  keys: KANBAN_KEYS,
  help: {
    mouse: "Drag a card to another column (Escape cancels the drag), or make a card current and use Move to… to pick its column.",
    answer: "The agent receives the cards you moved and the column each one is in now; their order and the columns stay as they were."
  },
  skill: {
    use: "cards the user moves between 2 to 12 columns, such as statuses, priorities or owners",
    notes: [
      "Each card names its `column` by ID; the answer's changes are `set`s of `<id>.<card>.column`. The user only moves cards: their order, labels and the columns stay."
    ]
  }
};

// packages/contract/src/widgets/latex/constants.ts
var LATEX_EXPRESSION_MAX_CHARS = 2000;
var LATEX_DEFINING_COMMANDS = /* @__PURE__ */ Object.freeze([
  "\\def",
  "\\gdef",
  "\\edef",
  "\\xdef",
  "\\global",
  "\\long",
  "\\let",
  "\\futurelet",
  "\\newcommand",
  "\\renewcommand",
  "\\providecommand"
]);
var LATEX_LEVEL_OPENERS = /* @__PURE__ */ Object.freeze([
  "\\bgroup",
  "\\begingroup",
  "\\begin",
  "\\left"
]);
var LATEX_LEVEL_CLOSERS = /* @__PURE__ */ Object.freeze([
  "\\egroup",
  "\\endgroup",
  "\\end",
  "\\right"
]);
var LATEX_INFIX_COMMANDS = /* @__PURE__ */ Object.freeze([
  "\\over",
  "\\choose",
  "\\atop",
  "\\brace",
  "\\brack",
  "\\above"
]);
var LATEX_RAW_TOKEN_COMMANDS = /* @__PURE__ */ Object.freeze({
  "\\char": "refusedWithBackquote",
  "\\show": "refused",
  "\\noexpand": "pushesBack",
  "\\expandafter": "pushesBack"
});
var LATEX_NESTING_MAX_DEPTH = 11;
var LATEX_SHAPE = /* @__PURE__ */ Object.freeze({
  fields: /* @__PURE__ */ Object.freeze(["expression"])
});

// packages/contract/src/widgets/latex/scan.ts
var DEFINING = new Set(LATEX_DEFINING_COMMANDS);
var OPENERS = new Set(LATEX_LEVEL_OPENERS);
var CLOSERS = new Set(LATEX_LEVEL_CLOSERS);
var INFIX = new Set(LATEX_INFIX_COMMANDS);
var GROUP = 0;
var AWAITING = 1;
var BOUND = 2;
const newState = () => ({
  kinds: [GROUP],
  inners: [0],
  infixes: [false],
  refused: undefined
});
const top = (state) => state.kinds.length - 1;
const push = (state, kind) => {
  state.kinds.push(kind);
  state.inners.push(0);
  state.infixes.push(false);
};
const pop = (state) => {
  const at = top(state);
  const reached = 1 + (state.inners[at] ?? 0) + (state.infixes[at] ? 1 : 0);
  state.kinds.pop();
  state.inners.pop();
  state.infixes.pop();
  if (reached > (state.inners[at - 1] ?? 0))
    state.inners[at - 1] = reached;
};
const deepestOf = (state) => {
  while (top(state) > 0)
    pop(state);
  return (state.inners[0] ?? 0) + (state.infixes[0] ? 1 : 0);
};
const isControlLetter = (code) => code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 64;
const isBlank = (char) => char === " " || char === "\t" || char === "\r" || char === `
`;
var LINE_SEPARATORS = String.fromCharCode(8232, 8233);
const isLineEnd = (char) => char === `
` || char === "\r" || char !== undefined && LINE_SEPARATORS.includes(char);
const take = (state, kind) => {
  if (state.kinds[top(state)] === AWAITING) {
    if (kind === "open") {
      state.kinds[top(state)] = BOUND;
    } else {
      pop(state);
      if (kind === "close")
        return;
    }
  }
  if (kind === "open")
    push(state, GROUP);
  else if (kind === "script")
    push(state, AWAITING);
  else if (kind === "close" && top(state) > 0) {
    pop(state);
    if (state.kinds[top(state)] === BOUND)
      pop(state);
  }
};
const takeInfix = (state) => {
  take(state, "other");
  state.infixes[top(state)] = true;
};
const controlEnd = (text, at) => {
  let end = at + 1;
  while (end < text.length && isControlLetter(text.charCodeAt(end)))
    end += 1;
  return end === at + 1 ? Math.min(at + 2, text.length) : end;
};
const isMark = (code) => code >= 768 && code <= 879;
const markRunEnd = (text, from, to) => {
  let end = from;
  while (end < to && isMark(text.charCodeAt(end)))
    end += 1;
  return end;
};
const reach = (state, count) => {
  if (count + 1 > (state.inners[top(state)] ?? 0))
    state.inners[top(state)] = count + 1;
};
const takeMarks = (state, count) => {
  take(state, "other");
  reach(state, count);
};
const skipBlanksAndComments = (text, from) => {
  let at = from;
  while (at < text.length) {
    if (isBlank(text[at]))
      at += 1;
    else if (text[at] === "%") {
      const end = text.indexOf(`
`, at);
      at = end === -1 ? text.length : end + 1;
    } else
      break;
  }
  return at;
};
const skipEnvironmentName = (text, from) => {
  const open = skipBlanksAndComments(text, from);
  if (text[open] !== "{")
    return from;
  let end = open + 1;
  while (end < text.length && (isControlLetter(text.charCodeAt(end)) || text[end] === "*")) {
    end += 1;
  }
  const letters = text.slice(open + 1, end);
  return text[end] === "}" && letters.length > 0 && !letters.includes("@") ? end + 1 : from;
};
const verbBody = (text, end) => {
  const star = text[end] === "*" ? 1 : 0;
  const delimiterAt = end + star;
  if (delimiterAt >= text.length)
    return { from: end, to: end, next: end };
  const delimiter = text[delimiterAt];
  let to = delimiterAt + 1;
  while (to < text.length && text[to] !== delimiter && !isLineEnd(text[to]))
    to += 1;
  return {
    from: delimiterAt + 1,
    to,
    next: text[to] === delimiter && to < text.length ? to + 1 : to
  };
};
const scanQuiet = (text, from, to, state) => {
  let at = from;
  while (at < to) {
    const char = text[at];
    if (char === "\\") {
      const end = Math.min(controlEnd(text, at), to);
      const word = text.slice(at, end);
      noteRefused(state, word);
      if (OPENERS.has(word))
        take(state, "open");
      at = end;
    } else if (isMark(text.charCodeAt(at))) {
      const end = markRunEnd(text, at, to);
      reach(state, end - at);
      at = end;
    } else {
      if (char === "{")
        take(state, "open");
      else if (char === "^" || char === "_")
        take(state, "script");
      at += 1;
    }
  }
};
const noteRefused = (state, word) => {
  if (state.refused !== undefined)
    return;
  if (DEFINING.has(word) || word.includes("@") || LATEX_RAW_TOKEN_COMMANDS[word] === "refused") {
    state.refused = word;
  }
};
const noteCharCode = (text, end, state) => {
  if (state.refused === undefined && text[skipBlanksAndComments(text, end)] === "`") {
    state.refused = "\\char`";
  }
};
const scanControl = (text, at, state) => {
  const end = controlEnd(text, at);
  if (end === at + 1)
    return end;
  const word = text.slice(at, end);
  if (end - at === 2 && !isControlLetter(text.charCodeAt(at + 1))) {
    take(state, "other");
    return end;
  }
  noteRefused(state, word);
  if (word === "\\verb") {
    take(state, "other");
    const { from, to, next } = verbBody(text, end);
    scanQuiet(text, from, to, state);
    return next;
  }
  if (INFIX.has(word)) {
    takeInfix(state);
    return end;
  }
  if (OPENERS.has(word)) {
    take(state, "open");
    return word === "\\begin" ? skipEnvironmentName(text, end) : end;
  }
  if (CLOSERS.has(word)) {
    take(state, "close");
    return word === "\\end" ? skipEnvironmentName(text, end) : end;
  }
  take(state, "other");
  if (LATEX_RAW_TOKEN_COMMANDS[word] === "refusedWithBackquote")
    noteCharCode(text, end, state);
  return end;
};
const scanLatex = (text) => {
  const state = newState();
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (char === "\\") {
      at = scanControl(text, at, state);
    } else if (char === "%") {
      const end = text.indexOf(`
`, at);
      const to = end === -1 ? text.length : end;
      scanQuiet(text, at + 1, to, state);
      at = to + 1;
    } else if (isMark(text.charCodeAt(at))) {
      const end = markRunEnd(text, at, text.length);
      takeMarks(state, end - at);
      at = end;
    } else {
      if (char === "{")
        take(state, "open");
      else if (char === "}")
        take(state, "close");
      else if (char === "^" || char === "_")
        take(state, "script");
      else if (!isBlank(char))
        take(state, "other");
      at += 1;
    }
  }
  return { refused: state.refused, depth: deepestOf(state) };
};

// packages/contract/src/widgets/latex/checks.ts
const latexPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a LaTeX's props are an object {expression}" }];
  }
  const problems = Object.keys(props).filter((key) => key !== "expression").map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const { expression } = props;
  if (typeof expression !== "string") {
    problems.push({ path: "/expression", message: "the expression is a text" });
  } else {
    const count = codePointCount2(expression);
    if (count > LATEX_EXPRESSION_MAX_CHARS) {
      problems.push({
        path: "/expression",
        message: `the expression has ${count} characters, more than the limit of ${LATEX_EXPRESSION_MAX_CHARS}`
      });
    } else {
      const { refused, depth } = scanLatex(expression);
      if (refused !== undefined) {
        problems.push({ path: "/expression", message: refusedMessage(refused) });
      } else if (depth > LATEX_NESTING_MAX_DEPTH) {
        problems.push({
          path: "/expression",
          message: `the expression nests ${depth} levels deep, more than the limit of ${LATEX_NESTING_MAX_DEPTH}`
        });
      }
    }
  }
  return problems;
};
const codePointCount2 = (text) => text.length <= LATEX_EXPRESSION_MAX_CHARS ? text.length : [...text].length;
const refusedMessage = (word) => {
  if (LATEX_DEFINING_COMMANDS.includes(word)) {
    return `the expression defines a macro with \`${word}\`, which a LaTeX item does not allow`;
  }
  if (word === "\\show") {
    return `the expression uses \`${word}\`, which a LaTeX item does not allow`;
  }
  if (word === "\\char`") {
    return `the expression uses \`\`${word} \`\`, which a LaTeX item does not allow`;
  }
  return `the expression names \`${word}\`, one of KaTeX's internal commands, which a LaTeX item does not allow`;
};
// packages/contract/src/widgets/latex/latex-changes.json
var latex_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:latex-changes",
  title: "LaTeX changes",
  description: "A LaTeX's changes (AD-20, FR-20, latex-kanban-timeline design decision 3): set operations of the one generic diff on the item's own field, addressed as item.expression (AD-13's reference syntax without brackets). One set carries the whole expression as the user wrote it, which may be empty and may not parse; a LaTeX never adds, removes or moves an element and never clears the field. In the output format since latex-kanban-timeline.",
  type: "array",
  items: { $ref: "#/$defs/set" },
  $defs: {
    set: {
      type: "object",
      properties: {
        op: { const: "set" },
        target: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}\\.expression$" },
        value: { type: "string", minLength: 0, maxLength: 2000 }
      },
      required: ["op", "target", "value"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/latex/latex-props.json
var latex_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:latex-props",
  title: "LaTeX props",
  description: "A LaTeX item's props (FR-11, latex-kanban-timeline design decision 3): one expression of 0 to 2000 characters, which the board shows as a source field with a live preview. The contract never parses it: KaTeX is the board's. In the input format since latex-kanban-timeline.",
  type: "object",
  properties: {
    expression: { type: "string", minLength: 0, maxLength: 2000 }
  },
  required: ["expression"],
  additionalProperties: false
};

// packages/contract/src/widgets/latex/wording.ts
var LATEX_EXPRESSION_SHAPE = `text of 0 to ${LATEX_EXPRESSION_MAX_CHARS} characters, LaTeX source that may be empty, with no macro definition, no internal command (a name holding \`@\`) and no nest deeper than ${LATEX_NESTING_MAX_DEPTH} levels`;
var LATEX_EXPECTED = {
  "latex.props": "a LaTeX's props {expression}",
  "latex.props.expression": LATEX_EXPRESSION_SHAPE
};
var LATEX_FIELDS = {
  "latex.props": "a LaTeX's props hold only expression"
};

// packages/contract/src/widgets/latex/widget.ts
var LATEX_WIDGET = {
  type: "latex",
  noun: "a LaTeX",
  props: latex_props_default,
  propsProblems: latexPropsProblems,
  edits: { changes: latex_changes_default, shape: () => LATEX_SHAPE },
  wording: { expected: LATEX_EXPECTED, fields: LATEX_FIELDS },
  example: {
    item: {
      type: "latex",
      id: "formula",
      props: { expression: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" }
    }
  },
  help: {
    mouse: "Type or correct the LaTeX in the source box; the preview beside it redraws as you write.",
    answer: "The agent receives the whole expression as you wrote it, even if it does not draw."
  },
  skill: {
    use: "one mathematical expression in LaTeX that the user reads and corrects, with a live preview",
    notes: [
      "The answer's change is one `set` of `<id>.expression`: the whole expression as the user wrote it, which may not parse.",
      "KaTeX draws it as data: `\\href`, `\\url` and `\\includegraphics` show no link or image.",
      `The ask is refused for a macro definition (\`\\def\`, \`\\newcommand\`, …), a KaTeX internal command (a name holding \`@\`), \`\\show\`, \`\\char\` before a backquote, and a nest deeper than ${LATEX_NESTING_MAX_DEPTH} levels.`
    ]
  }
};

// packages/contract/src/locale/tables.ts
var MINOR_UNITS = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4
};
var DEFAULT_MINOR_UNITS = 2;

// packages/contract/src/locale/amount.ts
var AMOUNT_PATTERN = /^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$/;
var EMPTY = Object.freeze({ kind: "empty" });
const minorUnitsOf = (currency) => Object.hasOwn(MINOR_UNITS, currency) ? MINOR_UNITS[currency] ?? DEFAULT_MINOR_UNITS : DEFAULT_MINOR_UNITS;
const decimalsOf = (amount) => amount.split(".")[1]?.length ?? 0;
const minorUnitsProblem = (amount, currency) => {
  const places = minorUnitsOf(currency);
  const held = decimalsOf(amount);
  if (held <= places)
    return;
  const takes = places === 0 ? "no decimals" : `at most ${places} decimals`;
  return `${currency} takes ${takes}, and the amount ${amount} has ${held}`;
};
const withoutTrailingZeros = (text) => {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 48)
    end -= 1;
  return text.slice(0, end);
};
const partsOf = (value) => {
  const negative = value.startsWith("-");
  const [whole = "", fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const integer = whole.replace(/^0+/, "");
  const decimals = withoutTrailingZeros(fraction);
  const zero = integer === "" && decimals === "";
  return { sign: negative && !zero ? -1 : 1, whole: integer, fraction: decimals };
};
const compareText = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const compareDecimal = (a, b) => {
  const left = partsOf(a);
  const right = partsOf(b);
  const leftZero = left.whole === "" && left.fraction === "";
  const rightZero = right.whole === "" && right.fraction === "";
  if (leftZero && rightZero)
    return 0;
  if (left.sign !== right.sign)
    return left.sign < right.sign ? -1 : 1;
  const width = Math.max(left.fraction.length, right.fraction.length);
  const magnitude = left.whole.length === right.whole.length ? compareText(left.whole + left.fraction.padEnd(width, "0"), right.whole + right.fraction.padEnd(width, "0")) : left.whole.length < right.whole.length ? -1 : 1;
  if (magnitude === 0 || left.sign === 1)
    return magnitude;
  return magnitude === 1 ? -1 : 1;
};

// packages/contract/src/widgets/money-field/constants.ts
var MONEY_FIELD_MIN_CURRENCIES = 2;
var MONEY_FIELD_MAX_CURRENCIES = 10;

// packages/contract/src/widgets/money-field/checks.ts
var KEYS2 = ["label", "description", "currency", "currencies", "min", "max", "required"];
var CURRENCY = /^[A-Z]{3}$/;
const textWithin2 = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const isAmount = (value) => typeof value === "string" && AMOUNT_PATTERN.test(value);
const isCurrency = (value) => typeof value === "string" && CURRENCY.test(value);
const inexpressible = (props, bound) => {
  const offered = Array.isArray(props.currencies) ? props.currencies : [props.currency];
  return offered.find((code) => isCurrency(code) && decimalsOf(bound) > minorUnitsOf(code));
};
const currenciesProblems = (currencies) => {
  const at = (path, message) => ({ path, message });
  const range = `${MONEY_FIELD_MIN_CURRENCIES} to ${MONEY_FIELD_MAX_CURRENCIES}`;
  if (!Array.isArray(currencies)) {
    return [at("/currencies", `currencies is a list of ${range} unique ISO 4217 codes`)];
  }
  const problems = [];
  if (currencies.length < MONEY_FIELD_MIN_CURRENCIES || currencies.length > MONEY_FIELD_MAX_CURRENCIES) {
    problems.push(at("/currencies", `currencies lists ${currencies.length} codes, and a list has ${range}`));
  }
  currencies.forEach((code, index) => {
    if (!isCurrency(code)) {
      problems.push(at(`/currencies/${index}`, "a currency is an ISO 4217 code of three capital letters"));
    }
  });
  if (new Set(currencies).size < currencies.length) {
    problems.push(at("/currencies", "currencies lists a code twice"));
  }
  return problems;
};
const moneyFieldPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a MoneyField's props are an object {label, ...}" }];
  }
  const problems = Object.keys(props).filter((key) => !KEYS2.includes(key)).map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
  if (!textWithin2(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (props.description !== undefined && !textWithin2(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  const { currency, currencies } = props;
  if (currency !== undefined && !isCurrency(currency)) {
    at("/currency", "the currency is an ISO 4217 code of three capital letters");
  }
  if (currencies !== undefined)
    problems.push(...currenciesProblems(currencies));
  if (currency === undefined && currencies === undefined) {
    at("/currency", "give currency, or currencies for the user to pick from");
  } else if (currency !== undefined && currencies !== undefined) {
    at("/currencies", "give currency or currencies, not both");
  }
  for (const key of ["min", "max"]) {
    if (props[key] !== undefined && !isAmount(props[key])) {
      at(`/${key}`, `${key} is a decimal string of at most 15 integer digits and 4 decimals`);
    }
  }
  if (isAmount(props.min) && isAmount(props.max) && compareDecimal(props.min, props.max) > 0) {
    at("/max", `max ${props.max} is below min ${props.min}`);
  }
  for (const key of ["min", "max"]) {
    const bound = props[key];
    const code = isAmount(bound) ? inexpressible(props, bound) : undefined;
    if (isAmount(bound) && code !== undefined) {
      at(`/${key}`, `${key} ${bound} has more decimals than ${code} takes (${minorUnitsOf(code)}), so no ${code} amount can lie on it`);
    }
  }
  return problems;
};
const isResult = (result) => isRecord(result) && Object.keys(result).length === 2 && isAmount(result.amount) && isCurrency(result.currency);
const moneyFieldResultProblems = (result, props) => {
  if (!isRecord(props) || moneyFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no MoneyField's, so its result cannot be checked"
      }
    ];
  }
  if (!isResult(result))
    return [];
  const { amount, currency } = result;
  const offered = Array.isArray(props.currencies) ? props.currencies : [props.currency];
  const problems = [];
  const at = (path, message) => problems.push({ path, message });
  if (!offered.includes(currency)) {
    at("/currency", `the currency ${currency} is not one of the field's: ${offered.join(", ")}`);
  }
  const finer = minorUnitsProblem(amount, currency);
  if (finer !== undefined)
    at("/amount", finer);
  if (isAmount(props.min) && compareDecimal(amount, props.min) < 0) {
    at("/amount", `the amount ${amount} is below the field's minimum ${props.min}`);
  }
  if (isAmount(props.max) && compareDecimal(amount, props.max) > 0) {
    at("/amount", `the amount ${amount} is above the field's maximum ${props.max}`);
  }
  return problems;
};
const moneyFieldResultShape = (result) => isResult(result);
const moneyFieldFieldCheck = (result, props) => requiredFailure(props, result);
// packages/contract/src/widgets/money-field/money-field-props.json
var money_field_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:money-field-props",
  title: "MoneyField props",
  description: "A MoneyField item's props (FR-13, atoms design decisions 1 and 2): a label of 1 to 200 characters, an optional description of 1 to 1000, exactly one of currency (an ISO 4217 code) and currencies (2 to 10 unique codes the user picks from), and optional min and max, decimal strings of at most 15 integer digits and 4 decimals. That exactly one of the two currency fields is given and that max is not below min are checks of moneyFieldPropsProblems. `required` since form-widget. In the input format since atoms.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    currencies: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      uniqueItems: true,
      items: { type: "string", pattern: "^[A-Z]{3}$" }
    },
    min: { type: "string", pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$" },
    max: { type: "string", pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$" },
    required: { type: "boolean" }
  },
  required: ["label"],
  additionalProperties: false
};
// packages/contract/src/widgets/money-field/money-field-result.json
var money_field_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:money-field-result",
  title: "MoneyField result",
  description: "A MoneyField's result (FR-13, FR-18, atoms design decisions 1 and 2): the amount, a decimal string of at most 15 integer digits and 4 decimals, and its currency, an ISO 4217 code. That the amount has at most the currency's minor units in decimals, lies within the item's min and max and that the currency is the item's are checks of the type against the item's props. In the output format since atoms.",
  type: "object",
  properties: {
    amount: { type: "string", pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$" },
    currency: { type: "string", pattern: "^[A-Z]{3}$" }
  },
  required: ["amount", "currency"],
  additionalProperties: false
};

// packages/contract/src/widgets/money-field/wording.ts
var CODE = "an ISO 4217 code of three capital letters, as in EUR";
var DECIMAL = "a decimal string of at most 15 integer digits and 4 decimals, as in 12480.50";
var MONEY_FIELD_EXPECTED = {
  "money-field.props": "a MoneyField's props {label, description?, required?, currency or currencies, min?, max?}",
  "money-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "money-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "money-field.props.required": "true, for a field that must hold a value before the question is answered",
  "money-field.props.currency": `${CODE}: the one currency, given instead of currencies`,
  "money-field.props.currencies": `a list of ${MONEY_FIELD_MIN_CURRENCIES} to ${MONEY_FIELD_MAX_CURRENCIES} unique ISO 4217 codes the user picks from, given instead of currency`,
  "money-field.props.currencies[]": CODE,
  "money-field.props.min": `${DECIMAL}, the lowest amount`,
  "money-field.props.max": `${DECIMAL}, the highest amount, not below min`
};
var MONEY_FIELD_FIELDS = {
  "money-field.props": "a MoneyField's props hold only label, description, required, currency, currencies, min and max"
};

// packages/contract/src/widgets/money-field/widget.ts
var MONEY_FIELD_WIDGET = {
  type: "money-field",
  noun: "a MoneyField",
  props: money_field_props_default,
  propsProblems: moneyFieldPropsProblems,
  fieldCheck: moneyFieldFieldCheck,
  result: {
    schema: money_field_result_default,
    shape: moneyFieldResultShape,
    problems: moneyFieldResultProblems
  },
  wording: { expected: MONEY_FIELD_EXPECTED, fields: MONEY_FIELD_FIELDS },
  example: {
    item: {
      type: "money-field",
      id: "fee",
      props: { label: "Budget", currency: "EUR", min: "0" }
    }
  },
  help: {
    mouse: "Type an amount, and pick the currency where more than one is offered.",
    answer: "The agent receives the amount and its currency."
  },
  skill: {
    use: "an amount of money the user types, in one currency or one picked from a list",
    notes: [
      "Give `currency`, or `currencies` (2 to 10 codes) for the user to pick from, never both. `min` and `max` are decimal strings. The result is `{amount, currency}` with `amount` a decimal string."
    ]
  }
};

// packages/contract/src/widgets/number-field/constants.ts
var NUMBER_FIELD_STEP_MAX = 2 * ATOM_NUMBER_BOUND;
var NUMBER_FIELD_STEP_TOLERANCE = 0.000000001;
var NUMBER_FIELD_STEP_UNDECIDABLE = 0.25;

// packages/contract/src/widgets/number-field/checks.ts
var KEYS3 = ["label", "description", "min", "max", "step", "integer", "unit", "required"];
const textWithin3 = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const bounded = (value) => typeof value === "number" && Number.isFinite(value) && value >= -ATOM_NUMBER_BOUND && value <= ATOM_NUMBER_BOUND;
const stepTolerance = (magnitude, step) => Math.max(NUMBER_FIELD_STEP_TOLERANCE, 8 * Number.EPSILON * magnitude / step);
const stepIndex = (value, min, step) => {
  const tolerance = stepTolerance(Math.max(Math.abs(min), Math.abs(value)), step);
  const quotient = (value - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) && tolerance < NUMBER_FIELD_STEP_UNDECIDABLE && Math.abs(quotient - whole) <= tolerance ? whole : undefined;
};
const numberFieldPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a NumberField's props are an object {label, ...}" }];
  }
  const problems = Object.keys(props).filter((key) => !KEYS3.includes(key)).map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
  if (!textWithin3(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (props.description !== undefined && !textWithin3(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  for (const key of ["min", "max"]) {
    if (props[key] !== undefined && !bounded(props[key])) {
      at(`/${key}`, `${key} is a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`);
    }
  }
  const { step } = props;
  if (step !== undefined && !(typeof step === "number" && Number.isFinite(step) && step > 0 && step <= NUMBER_FIELD_STEP_MAX)) {
    at("/step", `step is a number above 0 and at most ${NUMBER_FIELD_STEP_MAX}`);
  }
  if (props.integer !== undefined && typeof props.integer !== "boolean") {
    at("/integer", "integer is true or false");
  }
  if (props.unit !== undefined && !textWithin3(props.unit, ATOM_UNIT_MAX_CHARS)) {
    at("/unit", `the unit is a text of 1 to ${ATOM_UNIT_MAX_CHARS} characters`);
  }
  if (bounded(props.min) && bounded(props.max) && props.max < props.min) {
    at("/max", `max ${props.max} is below min ${props.min}`);
  }
  return [...problems, ...stepProblems(props)];
};
const stepProblems = (props) => {
  const { step, min, max } = props;
  if (typeof step !== "number" || !(step > 0) || !Number.isFinite(step))
    return [];
  const magnitude = Math.max(bounded(min) ? Math.abs(min) : 0, bounded(max) ? Math.abs(max) : 0);
  return stepTolerance(magnitude, step) < NUMBER_FIELD_STEP_UNDECIDABLE ? [] : [
    {
      path: "/step",
      message: `step ${step} is too fine for bounds this large: the numbers up to ${magnitude} cannot tell a value on the step from one off it`
    }
  ];
};
const numberFieldResultProblems = (result, props) => {
  if (!isRecord(props) || numberFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no NumberField's, so its result cannot be checked"
      }
    ];
  }
  if (typeof result !== "number" || !Number.isFinite(result))
    return [];
  const at = (message) => [{ path: "/", message }];
  const { min, max, step } = props;
  if (min !== undefined && result < min)
    return at(`${result} is below the field's minimum ${min}`);
  if (max !== undefined && result > max)
    return at(`${result} is above the field's maximum ${max}`);
  const problems = [];
  if (props.integer === true && !Number.isInteger(result)) {
    problems.push({
      path: "/",
      message: `${result} is not a whole number, and this field takes whole numbers`
    });
  }
  if (step !== undefined && stepIndex(result, min ?? 0, step) === undefined) {
    problems.push({
      path: "/",
      message: `${result} is not on a step of ${step} from ${min ?? 0}, or is too large for the step to be told`
    });
  }
  return problems;
};
const numberFieldResultShape = (result) => bounded(result);
const numberFieldFieldCheck = (result, props) => requiredFailure(props, result);
// packages/contract/src/widgets/number-field/number-field-props.json
var number_field_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:number-field-props",
  title: "NumberField props",
  description: "A NumberField item's props (FR-13, atoms design decision 1): a label of 1 to 200 characters, an optional description of 1 to 1000, optional min and max within a quadrillion either way, an optional step above 0, an optional integer and an optional unit of 1 to 20 characters. That max is not below min is a check of numberFieldPropsProblems. `required` since form-widget. In the input format since atoms.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    min: { type: "number", minimum: -1000000000000000, maximum: 1000000000000000 },
    max: { type: "number", minimum: -1000000000000000, maximum: 1000000000000000 },
    step: { type: "number", exclusiveMinimum: 0, maximum: 2000000000000000 },
    integer: { type: "boolean" },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    required: { type: "boolean" }
  },
  required: ["label"],
  additionalProperties: false
};
// packages/contract/src/widgets/number-field/number-field-result.json
var number_field_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:number-field-result",
  title: "NumberField result",
  description: "A NumberField's result (FR-13, FR-18, atoms design decision 1): a JSON number within a quadrillion either way. That it lies within the item's min and max, is whole when the item is integer and is on the item's step are checks of the type against the item's props. In the output format since atoms.",
  type: "number",
  minimum: -1000000000000000,
  maximum: 1000000000000000
};

// packages/contract/src/widgets/number-field/wording.ts
var BOUND2 = `a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`;
var NUMBER_FIELD_EXPECTED = {
  "number-field.props": "a NumberField's props {label, description?, required?, min?, max?, step?, integer?, unit?}",
  "number-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "number-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "number-field.props.required": "true, for a field that must hold a value before the question is answered",
  "number-field.props.min": `${BOUND2}, the lowest value`,
  "number-field.props.max": `${BOUND2}, the highest value, not below min`,
  "number-field.props.step": `a number above 0 and at most ${NUMBER_FIELD_STEP_MAX}: values lie on it, counted from min, else from 0`,
  "number-field.props.integer": "true, for a field that takes whole numbers",
  "number-field.props.unit": text(ATOM_UNIT_MAX_CHARS)
};
var NUMBER_FIELD_FIELDS = {
  "number-field.props": "a NumberField's props hold only label, description, required, min, max, step, integer and unit"
};

// packages/contract/src/widgets/number-field/widget.ts
var NUMBER_FIELD_WIDGET = {
  type: "number-field",
  noun: "a NumberField",
  props: number_field_props_default,
  propsProblems: numberFieldPropsProblems,
  fieldCheck: numberFieldFieldCheck,
  result: {
    schema: number_field_result_default,
    shape: numberFieldResultShape,
    problems: numberFieldResultProblems
  },
  wording: { expected: NUMBER_FIELD_EXPECTED, fields: NUMBER_FIELD_FIELDS },
  example: {
    item: {
      type: "number-field",
      id: "days",
      props: { label: "Days of leave", min: 0, max: 20, step: 0.5, unit: "days" }
    }
  },
  help: {
    mouse: "Click the box and type a number; its unit and limits are shown beside it.",
    answer: "The agent receives the number you typed."
  },
  skill: {
    use: "a number the user types, with optional bounds, a step and a unit",
    notes: [
      "`min` and `max` bound it, `integer` takes whole numbers, `step` (counted from `min`, else 0) fixes the grid, and `unit` is shown beside it. Use a Scale for a slider."
    ]
  }
};

// packages/contract/src/widgets/pick-field/constants.ts
var PICK_FIELD_MIN_OPTIONS = 2;
var PICK_FIELD_MAX_OPTIONS = 50;

// packages/contract/src/widgets/pick-field/checks.ts
var KEYS4 = ["label", "description", "required", "options", "multiple", "minItems", "maxItems"];
var OPTION_KEYS = ["id", "label", "description"];
var ID2 = new RegExp(ID_PATTERN);
const isId2 = (value) => typeof value === "string" && ID2.test(value);
const textWithin4 = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const isCount = (value) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= PICK_FIELD_MAX_OPTIONS;
const optionProblems = (option, index, seen) => {
  const where = `/options/${index}`;
  if (!isRecord(option)) {
    return [{ path: where, message: "an option is an object {id, label, description?}" }];
  }
  const problems = Object.keys(option).filter((key) => !OPTION_KEYS.includes(key)).map((key) => ({ path: `${where}/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path: `${where}${path}`, message });
  const { id } = option;
  if (!isId2(id)) {
    at("/id", `the option ID is ${ID_SHAPE}`);
  } else {
    if (id.startsWith(VIEW_ID_PREFIX)) {
      at("/id", `the option ID "${id}" starts with "${VIEW_ID_PREFIX}", which the board keeps for the IDs it makes itself`);
    }
    if (seen.has(id)) {
      at("/id", `the option ID "${id}" is held twice: each option of a PickField has an ID of its own`);
    }
    seen.add(id);
  }
  if (!textWithin4(option.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the option label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (option.description !== undefined && !textWithin4(option.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the option description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  return problems;
};
const countProblems = (props, options) => {
  const problems = [];
  const at = (path, message) => problems.push({ path, message });
  for (const key of ["minItems", "maxItems"]) {
    const value = props[key];
    if (value === undefined)
      continue;
    if (!isCount(value)) {
      at(`/${key}`, `${key} is a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}`);
    } else if (props.multiple !== true) {
      at(`/${key}`, `${key} counts the picks of a multiple pick: set multiple, or leave ${key} out`);
    } else if (value > options) {
      at(`/${key}`, `${key} ${value} is above the number of options, ${options}`);
    }
  }
  const { minItems, maxItems } = props;
  if (isCount(minItems) && isCount(maxItems) && minItems > maxItems) {
    at("/minItems", `minItems ${minItems} is above maxItems ${maxItems}`);
  }
  return problems;
};
const pickFieldPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a PickField's props are an object {label, options, ...}" }];
  }
  const problems = Object.keys(props).filter((key) => !KEYS4.includes(key)).map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
  if (!textWithin4(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (props.description !== undefined && !textWithin4(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  if (props.multiple !== undefined && typeof props.multiple !== "boolean") {
    at("/multiple", "multiple is true or false");
  }
  const { options } = props;
  if (!Array.isArray(options) || options.length < PICK_FIELD_MIN_OPTIONS || options.length > PICK_FIELD_MAX_OPTIONS) {
    at("/options", `options is a list of ${PICK_FIELD_MIN_OPTIONS} to ${PICK_FIELD_MAX_OPTIONS} options`);
  }
  const held = Array.isArray(options) ? options : [];
  const seen = new Set;
  for (const [index, option] of held.entries()) {
    problems.push(...optionProblems(option, index, seen));
  }
  problems.push(...countProblems(props, held.length));
  return problems;
};
const optionIds = (props) => {
  if (!isRecord(props) || pickFieldPropsProblems(props).length > 0)
    return;
  return props.options.map(({ id }) => id);
};
const pickFieldResultShape = (result) => isId2(result) || Array.isArray(result) && result.length >= 1 && result.length <= PICK_FIELD_MAX_OPTIONS && result.every(isId2) && new Set(result).size === result.length;
const pickFieldResultProblems = (result, props) => {
  const ids = optionIds(props);
  if (ids === undefined || !isRecord(props)) {
    return [
      {
        path: "/",
        message: "the item's props are no PickField's, so its result cannot be checked"
      }
    ];
  }
  const picked = Array.isArray(result) ? result : [result];
  const problems = [];
  if (props.multiple === true && !Array.isArray(result)) {
    problems.push({ path: "/", message: "a multiple pick gives a list of option IDs" });
  } else if (props.multiple !== true && Array.isArray(result)) {
    problems.push({ path: "/", message: "a single pick gives one option ID, not a list" });
  }
  const known = new Set(ids);
  for (const id of picked) {
    if (typeof id === "string" && !known.has(id)) {
      problems.push({ path: "/", message: `"${id}" is no option of this field` });
    }
  }
  if (problems.length === 0 && Array.isArray(result)) {
    const places = result.map((id) => ids.indexOf(id));
    if (places.some((place, at) => at > 0 && place < places[at - 1])) {
      problems.push({ path: "/", message: "the option IDs are not in the order of the options" });
    }
  }
  return problems;
};
const pickFieldFieldCheck = (result, props) => {
  const required = requiredFailure(props, result);
  if (required !== undefined)
    return required;
  if (!Array.isArray(result) || !isRecord(props) || props.multiple !== true)
    return;
  const { minItems, maxItems } = props;
  if (isCount(minItems) && result.length < minItems)
    return { code: "min-items", min: minItems };
  if (isCount(maxItems) && result.length > maxItems)
    return { code: "max-items", max: maxItems };
  return;
};
// packages/contract/src/widgets/pick-field/pick-field-props.json
var pick_field_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:pick-field-props",
  title: "PickField props",
  description: "A PickField item's props (FR-11, FR-13, form-widget design decision 4): a label of 1 to 200 characters, an optional description of 1 to 1000, an optional required, 2 to 50 options each with an ID, a label of 1 to 200 characters and an optional description of 1 to 1000, an optional multiple and, only with multiple, an optional minItems and maxItems. That the option IDs are unique in the item and do not start with u-, and that minItems is at most maxItems, which is at most the number of options, are checks of pickFieldPropsProblems. In the input format since form-widget.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    required: { type: "boolean" },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 50,
      items: { $ref: "#/$defs/option" }
    },
    multiple: { type: "boolean" },
    minItems: { type: "integer", minimum: 1, maximum: 50 },
    maxItems: { type: "integer", minimum: 1, maximum: 50 }
  },
  required: ["label", "options"],
  additionalProperties: false,
  $defs: {
    option: {
      description: "An option: its ID, unique in the item, its label and an optional description.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", minLength: 1, maxLength: 1000 }
      },
      required: ["id", "label"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/pick-field/pick-field-result.json
var pick_field_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:pick-field-result",
  title: "PickField result",
  description: "A PickField's result (FR-11, FR-18, form-widget design decision 4): an option ID for a single pick, or a list of 1 to 50 distinct option IDs for a multiple pick, never empty. The schema reads a string as an ID and anything else as the list, with no root combinator and no union type. That the IDs are the item's options', that a single pick gives one ID and a multiple pick a list, and that the list is in the options' order are checks of the type against the item's props. In the output format since form-widget.",
  if: { type: "string" },
  then: { type: "string", minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9_-]{1,64}$" },
  else: {
    type: "array",
    minItems: 1,
    maxItems: 50,
    uniqueItems: true,
    items: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" }
  }
};

// packages/contract/src/widgets/pick-field/wording.ts
var PICK_FIELD_EXPECTED = {
  "pick-field.props": "a PickField's props {label, description?, required?, options, multiple?, minItems?, maxItems?}",
  "pick-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "pick-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "pick-field.props.required": "true, for a field that must hold a value before the question is answered",
  "pick-field.props.options": `a list of ${PICK_FIELD_MIN_OPTIONS} to ${PICK_FIELD_MAX_OPTIONS} options, each {id, label, description?}`,
  "pick-field.props.options[]": "an option {id, label, description?}",
  "pick-field.props.options[].id": `${ID_SHAPE}, unique among the PickField's options and not starting with "${VIEW_ID_PREFIX}"`,
  "pick-field.props.options[].label": text(ATOM_LABEL_MAX_CHARS),
  "pick-field.props.options[].description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "pick-field.props.multiple": "true, for a pick of several options, shown as checkboxes",
  "pick-field.props.minItems": `a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}, the fewest options a multiple pick holds, given only with multiple`,
  "pick-field.props.maxItems": `a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}, the most options a multiple pick holds, not above the number of options, given only with multiple`
};
var PICK_FIELD_FIELDS = {
  "pick-field.props": "a PickField's props hold only label, description, required, options, multiple, minItems and maxItems",
  "pick-field.props.options[]": "an option holds only id, label and description"
};

// packages/contract/src/widgets/pick-field/widget.ts
var PICK_FIELD_WIDGET = {
  type: "pick-field",
  noun: "a PickField",
  props: pick_field_props_default,
  propsProblems: pickFieldPropsProblems,
  fieldCheck: pickFieldFieldCheck,
  result: {
    schema: pick_field_result_default,
    shape: pickFieldResultShape,
    problems: pickFieldResultProblems
  },
  wording: { expected: PICK_FIELD_EXPECTED, fields: PICK_FIELD_FIELDS },
  example: {
    item: {
      type: "pick-field",
      id: "region",
      props: {
        label: "Region",
        options: [
          { id: "eu", label: "Europe" },
          { id: "us", label: "North America" },
          { id: "apac", label: "Asia-Pacific", description: "Includes Oceania." }
        ]
      }
    }
  },
  help: {
    mouse: "Click an option to pick it, or several where the question allows more than one; a long list has a box to filter the options.",
    answer: "The agent receives the option or options you picked."
  },
  skill: {
    use: "one or several options picked from a list, as in a form",
    notes: [
      "Options are `{id, label, description?}`, 2 to 50. `multiple` allows several, with `minItems` and `maxItems`; the result is an option ID, or a list of IDs. An enum of an MCP form is a PickField, a string a TextField, a number a NumberField, a boolean a Toggle."
    ]
  }
};

// packages/contract/src/widgets/ranking/checks.ts
const idsOf = (props) => {
  const items = isRecord(props) ? props.items : undefined;
  if (!Array.isArray(items))
    return;
  return items.flatMap((element) => isRecord(element) && typeof element.id === "string" ? [element.id] : []);
};
const rankingPropsProblems = (props) => {
  const items = isRecord(props) && Array.isArray(props.items) ? props.items : [];
  const seen = new Set;
  const problems = [];
  items.forEach((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    if (typeof id !== "string")
      return;
    if (seen.has(id)) {
      problems.push({
        path: `/items/${index}/id`,
        message: `the ID "${id}" is held twice: each element of a Ranking has an ID of its own`
      });
    }
    seen.add(id);
  });
  return problems;
};
const rankingResultProblems = (result, props) => {
  const ids = idsOf(props);
  if (ids === undefined) {
    return [
      { path: "/", message: "the item's props are no Ranking's, so its order cannot be checked" }
    ];
  }
  const order = isRecord(result) && Array.isArray(result.order) ? result.order : [];
  const held = new Set(ids);
  const seen = new Set;
  const problems = [];
  order.forEach((id, index) => {
    if (typeof id !== "string")
      return;
    const path = `/order/${index}`;
    if (!held.has(id)) {
      problems.push({
        path,
        message: `the order names element "${id}", which the item does not hold`
      });
    } else if (seen.has(id)) {
      problems.push({ path, message: `the order names element "${id}" twice` });
    }
    seen.add(id);
  });
  for (const id of held) {
    if (!seen.has(id))
      problems.push({ path: "/order", message: `the order leaves out element "${id}"` });
  }
  return problems;
};
var ORDER_MIN = 2;
var ORDER_MAX = 50;
const rankingResultShape = (result) => {
  if (!isRecord(result))
    return false;
  const keys = Object.keys(result);
  const { order } = result;
  return keys.length === 1 && keys[0] === "order" && Array.isArray(order) && order.length >= ORDER_MIN && order.length <= ORDER_MAX && order.every((id) => typeof id === "string");
};

// packages/contract/src/widgets/ranking/keys.ts
var LIST = "list";
var TOOLBAR2 = "toolbar";
var RANKING_KEYS = [
  vocabularyEntry("cursor.up", LIST, "navigation"),
  vocabularyEntry("cursor.down", LIST, "navigation"),
  vocabularyEntry("cursor.first", LIST, "navigation"),
  vocabularyEntry("cursor.last", LIST, "navigation"),
  vocabularyEntry("select.toggle", LIST, "pointer"),
  vocabularyEntry("select.extendUp", LIST, "pointer"),
  vocabularyEntry("select.extendDown", LIST, "pointer"),
  vocabularyEntry("move.up", LIST, "tool", { label: "ranking.moveUp" }),
  vocabularyEntry("move.down", LIST, "tool", { label: "ranking.moveDown" }),
  vocabularyEntry("move.top", LIST, "tool", { label: "ranking.toTop" }),
  vocabularyEntry("move.bottom", LIST, "tool", { label: "ranking.toBottom" }),
  ownEntry("ranking.keep", LIST, [keyBinding("Enter")], "tool", {
    readOnly: false,
    label: "ranking.keep"
  }),
  vocabularyEntry("select.none", LIST, "tool", { label: "ranking.selectNone" }),
  vocabularyEntry("keys.open", LIST, "panel"),
  vocabularyEntry("toolbar.previous", TOOLBAR2, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR2, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR2, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR2, "navigation")
];
// packages/contract/src/widgets/ranking/ranking-props.json
var ranking_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:ranking-props",
  title: "Ranking props",
  description: "A Ranking item's props (FR-11, approval-scale-ranking design decision 1): 2 to 50 elements to put in order, each with its ID, its label and an optional description. That the IDs are unique within the item is checked by rankingPropsProblems. In the input format since approval-scale-ranking.",
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 50,
      items: { $ref: "#/$defs/element" }
    }
  },
  required: ["items"],
  additionalProperties: false,
  $defs: {
    element: {
      description: "An element of the ranking: its ID, unique in the item, its label and its description.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", minLength: 1, maxLength: 500 }
      },
      required: ["id", "label"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/widgets/ranking/ranking-result.json
var ranking_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:ranking-result",
  title: "Ranking result",
  description: "A Ranking's result (FR-11, FR-18, approval-scale-ranking design decision 1): the IDs of the item's elements in the user's order. That each of the item's elements is named exactly once is a check of the type against the item's props. Never empty. In the output format since approval-scale-ranking.",
  type: "object",
  properties: {
    order: {
      type: "array",
      minItems: 2,
      maxItems: 50,
      items: { $ref: "urn:askboard:input:id" }
    }
  },
  required: ["order"],
  additionalProperties: false
};

// packages/contract/src/widgets/ranking/constants.ts
var RANKING_MIN_ITEMS = 2;
var RANKING_MAX_ITEMS = 50;
var RANKING_LABEL_MAX_CHARS = 200;
var RANKING_DESCRIPTION_MAX_CHARS = 500;

// packages/contract/src/widgets/ranking/wording.ts
var RANKING_EXPECTED = {
  "ranking.props": "a Ranking's props {items}",
  "ranking.props.items": `a list of ${RANKING_MIN_ITEMS} to ${RANKING_MAX_ITEMS} elements, each {id, label, description?}`,
  "ranking.props.items[]": "an element {id, label, description?}",
  "ranking.props.items[].id": `${ID_SHAPE}, unique among the Ranking's elements`,
  "ranking.props.items[].label": text(RANKING_LABEL_MAX_CHARS),
  "ranking.props.items[].description": text(RANKING_DESCRIPTION_MAX_CHARS)
};
var RANKING_FIELDS = {
  "ranking.props": "a Ranking's props hold only items",
  "ranking.props.items[]": "an element holds only id, label and description"
};
const rankingElementOf = (item, rest) => {
  if (!isRecord(item) || rest[1] !== "items" || !isIndex(rest[2]))
    return;
  const items = isRecord(item.props) ? item.props.items : undefined;
  const element = Array.isArray(items) ? items[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `element "${id}"` : undefined;
};

// packages/contract/src/widgets/ranking/widget.ts
var RANKING_WIDGET = {
  type: "ranking",
  noun: "a Ranking",
  props: ranking_props_default,
  propsProblems: rankingPropsProblems,
  result: { schema: ranking_result_default, shape: rankingResultShape, problems: rankingResultProblems },
  wording: { expected: RANKING_EXPECTED, fields: RANKING_FIELDS, element: rankingElementOf },
  example: {
    item: {
      type: "ranking",
      id: "priorities",
      props: {
        items: [
          { id: "speed", label: "Speed" },
          { id: "cost", label: "Cost" },
          { id: "comfort", label: "Comfort" }
        ]
      }
    }
  },
  keys: RANKING_KEYS,
  help: {
    mouse: "Drag a row by its handle to a new place (Escape cancels the drag). Tick check boxes, or Shift+click for a range, to select rows: Move up, Move down, To top and To bottom then move the selected rows. Keep this order accepts the agent's order.",
    answer: "The agent receives the order you chose, with every item once. A ranking you did not touch gives no answer until you keep its order."
  },
  skill: {
    use: "an order of 2 to 50 items the user sets by dragging or with Move up and Move down",
    notes: ["`order` lists every item ID once; an untouched Ranking gives no result."]
  }
};

// packages/contract/src/widgets/row/checks.ts
const itemIdsOf = (props) => {
  const items = Object.hasOwn(props, "items") ? props.items : undefined;
  if (!Array.isArray(items))
    return new Set;
  return new Set(items.flatMap((item) => isRecord(item) && typeof item.id === "string" ? [item.id] : []));
};
const rowPropsProblems = (props) => {
  if (!isRecord(props) || !Object.hasOwn(props, "widths"))
    return [];
  const { widths } = props;
  if (!isRecord(widths))
    return [];
  const ids = itemIdsOf(props);
  return Object.keys(widths).filter((key) => !ids.has(key)).map((key) => ({
    path: `/widths/${key}`,
    message: `the width for "${key}" names no item of the Row: key each weight by the ID of one of its items`
  }));
};
// packages/contract/src/widgets/row/row-props.json
var row_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:row-props",
  title: "Row props",
  description: "A Row item's props (FR-13, layouts design decision 1): 2 to 4 items side by side, each an atom, a widget or a layout as the input format writes it, and optional relative widths, a weight from 1 to 4 keyed by the ID of one of the items. That each key names an item of the Row is checked by rowPropsProblems. A Row gives no result. In the input format since layouts.",
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { $ref: "urn:askboard:input:question-props#/$defs/layoutItem" }
    },
    widths: {
      type: "object",
      propertyNames: { $ref: "urn:askboard:input:id" },
      additionalProperties: { type: "integer", minimum: 1, maximum: 4 },
      maxProperties: 4
    }
  },
  required: ["items"],
  additionalProperties: false
};

// packages/contract/src/widgets/row/constants.ts
var ROW_MIN_ITEMS = 2;
var ROW_MAX_ITEMS = 4;
var ROW_MIN_WEIGHT = 1;
var ROW_MAX_WEIGHT = 4;

// packages/contract/src/widgets/row/wording.ts
var ROW_EXPECTED = {
  "row.props": "a Row's props {items, widths?}",
  "row.props.items": `a list of ${ROW_MIN_ITEMS} to ${ROW_MAX_ITEMS} items to show side by side`,
  "row.props.items[]": LAYOUT_CHILD_ITEM,
  "row.props.items[].type": LAYOUT_CHILD_TYPE,
  "row.props.widths": `an object whose keys are the IDs of the Row's items and whose values are weights, each a whole number from ${ROW_MIN_WEIGHT} to ${ROW_MAX_WEIGHT}`,
  "row.props.widths.{item}": `a whole number from ${ROW_MIN_WEIGHT} to ${ROW_MAX_WEIGHT}, keyed by ${ID_SHAPE}`
};
var ROW_FIELDS = {
  "row.props": "a Row's props hold only items and widths",
  "row.props.items[]": LAYOUT_CHILD_FIELDS
};
const rowRest = (rest) => rest[1] === "widths" && rest.length > 2 ? [rest[0], "widths", "{item}", ...rest.slice(3)] : rest;

// packages/contract/src/widgets/row/widget.ts
var ROW_WIDGET = {
  type: "row",
  noun: "a Row",
  props: row_props_default,
  propsProblems: rowPropsProblems,
  wording: { expected: ROW_EXPECTED, fields: ROW_FIELDS, rest: rowRest },
  example: {
    item: {
      type: "row",
      id: "arrange-row",
      props: {
        items: [
          { type: "number-field", id: "arrange-row-qty", props: { label: "Quantity", min: 0 } },
          { type: "text-field", id: "arrange-row-unit", props: { label: "Unit" } }
        ],
        widths: { "arrange-row-qty": 2 }
      }
    }
  },
  help: {
    mouse: "It places two to four items side by side, and stacks them on a narrow board: use the items themselves.",
    answer: "Nothing of its own: each item inside it gives its own answer."
  },
  skill: {
    use: "2 to 4 items side by side; a narrow board stacks them",
    notes: [
      "`widths` gives weights from 1 to 4, keyed by item ID; an item with none weighs 1. Put wide widgets (a Tree, a Gantt, a schedule or a board view) in a Stack or a tab, not a Row."
    ]
  }
};

// packages/contract/src/widgets/scale/constants.ts
var SCALE_BOUND = 1e9;
var SCALE_MAX_STEPS = 1000;
var SCALE_RATING_MAX_VALUES = 11;
var SCALE_LABEL_MAX_CHARS = 60;
var SCALE_UNIT_MAX_CHARS = 20;
var SCALE_DEFAULT_STEP = 1;
var SCALE_STEP_TOLERANCE = 0.000000001;

// packages/contract/src/widgets/scale/checks.ts
const finite2 = (value) => typeof value === "number" && Number.isFinite(value);
const grouped = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const stepsOver = (steps) => Number.isSafeInteger(steps) ? `has ${grouped(steps)} steps, over the limit of ${grouped(SCALE_MAX_STEPS)}` : `has more than ${grouped(SCALE_MAX_STEPS)} steps`;
const scaleStepCount = (min, max, step) => {
  const quotient = (max - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) && whole >= 1 && Math.abs(quotient - whole) <= SCALE_STEP_TOLERANCE ? whole : undefined;
};
var FLOOR_ULPS = 8;
const gridTolerance = (value, min, step) => Math.max(SCALE_STEP_TOLERANCE, FLOOR_ULPS * Number.EPSILON * Math.max(Math.abs(min), Math.abs(value)) / step);
const scaleStepIndex = (value, min, step) => {
  const quotient = (value - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) && Math.abs(quotient - whole) <= gridTolerance(value, min, step) ? whole : undefined;
};
const reading2 = (props) => {
  if (!isRecord(props))
    return;
  const { min, max } = props;
  const step = props.step === undefined ? SCALE_DEFAULT_STEP : props.step;
  if (!finite2(min) || !finite2(max) || !finite2(step) || step <= 0 || max <= min)
    return;
  const steps = scaleStepCount(min, max, step);
  return steps === undefined ? undefined : { min, max, step, steps, range: props.range === true };
};
var RATING_TEXT = `a rating takes one value out of at most ${SCALE_RATING_MAX_VALUES}`;
const scalePropsProblems = (props) => {
  if (!isRecord(props))
    return [];
  const { min, max } = props;
  const step = props.step === undefined ? SCALE_DEFAULT_STEP : props.step;
  if (!finite2(min) || !finite2(max) || !finite2(step) || step <= 0)
    return [];
  if (max <= min)
    return [{ path: "/max", message: `max ${max} is not above min ${min}` }];
  const at = props.step === undefined ? "/max" : "/step";
  const steps = scaleStepCount(min, max, step);
  if (steps === undefined) {
    const message = `a step of ${step} does not divide the scale from ${min} to ${max} into whole steps`;
    return [{ path: at, message }];
  }
  if (steps > SCALE_MAX_STEPS) {
    const message = `the scale from ${min} to ${max} in steps of ${step} ${stepsOver(steps)}`;
    return [{ path: at, message }];
  }
  if (props.display !== "rating")
    return [];
  const problems = [];
  if (props.range === true) {
    problems.push({ path: "/range", message: `${RATING_TEXT}: remove range` });
  }
  if (steps + 1 > SCALE_RATING_MAX_VALUES) {
    problems.push({
      path: "/display",
      message: `${RATING_TEXT}, and the scale from ${min} to ${max} in steps of ${step} has ${steps + 1} values`
    });
  }
  return problems;
};
const numberProblem = (name, value, read) => {
  if (!finite2(value))
    return;
  if (value < read.min || value > read.max) {
    return { path: `/${name}`, message: `${name} ${value} is outside ${read.min} to ${read.max}` };
  }
  return scaleStepIndex(value, read.min, read.step) === undefined ? {
    path: `/${name}`,
    message: `${name} ${value} is not on a step of ${read.step} from ${read.min}`
  } : undefined;
};
const scaleResultProblems = (result, props) => {
  const read = reading2(props);
  if (read === undefined) {
    return [
      { path: "/", message: "the item's props are no Scale's, so its result cannot be checked" }
    ];
  }
  if (!isRecord(result))
    return [];
  if (read.range) {
    if ("value" in result) {
      return [{ path: "/value", message: "a Scale with range takes low and high, not value" }];
    }
    const found = [
      numberProblem("low", result.low, read),
      numberProblem("high", result.high, read)
    ].filter((problem) => problem !== undefined);
    if (found.length > 0)
      return found;
    return result.low > result.high ? [{ path: "/low", message: `low ${result.low} is above high ${result.high}` }] : [];
  }
  if ("low" in result || "high" in result) {
    return [{ path: "/low", message: "a Scale without range takes value, not low and high" }];
  }
  const problem = numberProblem("value", result.value, read);
  return problem === undefined ? [] : [problem];
};
var RESULT_BOUND = 1e9;
const boundedNumber = (value) => finite2(value) && value >= -RESULT_BOUND && value <= RESULT_BOUND;
const scaleResultShape = (result) => {
  if (!isRecord(result))
    return false;
  const keys = Object.keys(result);
  if (keys.length === 1 && keys[0] === "value")
    return boundedNumber(result.value);
  return keys.length === 2 && keys.includes("low") && keys.includes("high") && boundedNumber(result.low) && boundedNumber(result.high);
};
// packages/contract/src/widgets/scale/scale-props.json
var scale_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:scale-props",
  title: "Scale props",
  description: "A Scale item's props (FR-11, approval-scale-ranking design decision 1): the bounds min and max within a billion either way, an optional step above 0 (1 when absent), an optional range, a display (slider or rating, slider when absent), the labels of its two ends and a unit. What a schema cannot say (max above min, the step dividing the scale into whole steps, at most 1,000 of them, a rating of one value and at most 11 values) is checked by scalePropsProblems. In the input format since approval-scale-ranking.",
  type: "object",
  properties: {
    min: { type: "number", minimum: -1e9, maximum: 1e9 },
    max: { type: "number", minimum: -1e9, maximum: 1e9 },
    step: { type: "number", exclusiveMinimum: 0, maximum: 2000000000 },
    range: { type: "boolean" },
    display: { enum: ["slider", "rating"] },
    minLabel: { type: "string", minLength: 1, maxLength: 60 },
    maxLabel: { type: "string", minLength: 1, maxLength: 60 },
    unit: { type: "string", minLength: 1, maxLength: 20 }
  },
  required: ["min", "max"],
  additionalProperties: false
};
// packages/contract/src/widgets/scale/scale-result.json
var scale_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:scale-result",
  title: "Scale result",
  description: "A Scale's result (FR-11, FR-18, approval-scale-ranking design decision 1): value, or low and high when the item has range, never both and never empty. That each number lies between min and max on a step, and which form the item takes, are checks of the type against the item's props. In the output format since approval-scale-ranking.",
  type: "object",
  properties: {
    value: { type: "number", minimum: -1e9, maximum: 1e9 },
    low: { type: "number", minimum: -1e9, maximum: 1e9 },
    high: { type: "number", minimum: -1e9, maximum: 1e9 }
  },
  if: { properties: { value: true }, required: ["value"] },
  then: { properties: { low: false, high: false } },
  else: { properties: { low: true, high: true }, required: ["low", "high"] },
  additionalProperties: false
};

// packages/contract/src/widgets/scale/wording.ts
var SCALE_EXPECTED = {
  "scale.props": "a Scale's props {min, max, step?, range?, display?, minLabel?, maxLabel?, unit?}",
  "scale.props.min": `a number from -${SCALE_BOUND} to ${SCALE_BOUND}, below max`,
  "scale.props.max": `a number from -${SCALE_BOUND} to ${SCALE_BOUND}, above min`,
  "scale.props.step": `a number above 0 that divides max minus min into at most ${SCALE_MAX_STEPS} whole steps, 1 when absent`,
  "scale.props.range": "true, for a slider that takes two values, low and high",
  "scale.props.display": `"slider" or "rating": a rating takes one value out of at most ${SCALE_RATING_MAX_VALUES}`,
  "scale.props.minLabel": text(SCALE_LABEL_MAX_CHARS),
  "scale.props.maxLabel": text(SCALE_LABEL_MAX_CHARS),
  "scale.props.unit": text(SCALE_UNIT_MAX_CHARS)
};
var SCALE_FIELDS = {
  "scale.props": "a Scale's props hold only min, max, step, range, display, minLabel, maxLabel and unit"
};

// packages/contract/src/widgets/scale/widget.ts
var SCALE_WIDGET = {
  type: "scale",
  noun: "a Scale",
  props: scale_props_default,
  propsProblems: scalePropsProblems,
  result: { schema: scale_result_default, shape: scaleResultShape, problems: scaleResultProblems },
  wording: { expected: SCALE_EXPECTED, fields: SCALE_FIELDS },
  example: {
    item: {
      type: "scale",
      id: "confidence",
      props: { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" }
    }
  },
  help: {
    mouse: "Drag the slider handle, or press a value of the rating, to set a number; nothing is set until you do.",
    answer: "The agent receives the value you set, or the low and high values of a range. A scale you did not touch gives no answer."
  },
  skill: {
    use: "a number on a slider (the Slider), a range between two numbers, or a rating of up to 11 values",
    notes: [
      "Nothing is set until the user sets it: the result is `value`, or `low` and `high` with `range`."
    ]
  }
};
// packages/contract/src/widgets/stack/stack-props.json
var stack_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:stack-props",
  title: "Stack props",
  description: "A Stack item's props (FR-13, layouts design decision 1): at least one item, shown one under another, each an atom, a widget or a layout as the input format writes it. A Stack gives no result. In the input format since layouts.",
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: { $ref: "urn:askboard:input:question-props#/$defs/layoutItem" }
    }
  },
  required: ["items"],
  additionalProperties: false
};

// packages/contract/src/widgets/stack/wording.ts
var STACK_EXPECTED = {
  "stack.props": "a Stack's props {items}",
  "stack.props.items": "a non-empty list of the items to show one under another",
  "stack.props.items[]": LAYOUT_CHILD_ITEM,
  "stack.props.items[].type": LAYOUT_CHILD_TYPE
};
var STACK_FIELDS = {
  "stack.props": "a Stack's props hold only items",
  "stack.props.items[]": LAYOUT_CHILD_FIELDS
};

// packages/contract/src/widgets/stack/widget.ts
var STACK_WIDGET = {
  type: "stack",
  noun: "a Stack",
  props: stack_props_default,
  propsProblems: noPropsProblems,
  wording: { expected: STACK_EXPECTED, fields: STACK_FIELDS },
  example: {
    item: {
      type: "stack",
      id: "arrange-stack",
      props: {
        items: [
          { type: "text", id: "arrange-stack-note", props: { text: "Fill in both fields." } },
          { type: "text-field", id: "arrange-stack-name", props: { label: "Name" } }
        ]
      }
    }
  },
  help: {
    mouse: "It only lays its items one under another: use the items themselves.",
    answer: "Nothing of its own: each item inside it gives its own answer."
  },
  skill: {
    use: "items one under another in a column, as one block of a question",
    notes: [
      "`items` hold atoms, widgets and other layouts, never excerpts, references, images or molecule references."
    ]
  }
};

// packages/contract/src/formula/grammar.ts
var FIELD_NAME_PATTERN = "^[A-Za-z][A-Za-z0-9]{0,63}$";
var CELL_PATTERN = "^([A-Z]{1,3})([1-9][0-9]{0,6})$";
var SHEET_MAX_COLUMN = 16384;
var SHEET_MAX_ROW = 1048576;
var BINARY_OPERATOR_PRECEDENCE = Object.freeze({
  "=": 1,
  "<>": 1,
  "<": 1,
  "<=": 1,
  ">": 1,
  ">=": 1,
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
  "^": 4
});
var CELL = new RegExp(CELL_PATTERN);
var FIELD_NAME = new RegExp(FIELD_NAME_PATTERN);
const cellWithin = (match) => {
  if (match === null)
    return;
  let column = 0;
  for (const letter of match[1] ?? "")
    column = column * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]);
  return column <= SHEET_MAX_COLUMN && row <= SHEET_MAX_ROW ? { column, row } : undefined;
};
const parseCell = (text) => cellWithin(CELL.exec(text));
const isFieldName = (name) => FIELD_NAME.test(name) && parseCell(name) === undefined;

// packages/contract/src/widgets/shared/property-names.ts
const words = (text) => new Set(text.split(" "));
var GENERAL_CATEGORIES = words("Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc " + "Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf " + "Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M " + "Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N " + "Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So " + "Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs " + "Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu");
var BINARY_PROPERTIES = words("ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M " + "Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM " + "Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT " + "Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia " + "Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext " + "Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB " + "IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C " + "Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax " + "Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI " + "Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo " + "Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS");
var CATEGORY_PREFIXES = ["General_Category=", "gc="];
const propertyNameAllowed = (name) => {
  const prefix = CATEGORY_PREFIXES.find((each) => name.startsWith(each));
  if (prefix !== undefined)
    return GENERAL_CATEGORIES.has(name.slice(prefix.length));
  return GENERAL_CATEGORIES.has(name) || BINARY_PROPERTIES.has(name);
};

// packages/contract/src/widgets/shared/pattern.ts
var PATTERN_MAX_CHARS = 200;
var PATTERN_TEXT_MAX_CHARS = 100;
var PATTERN_MAX_REPEATS = 3;
const isDigit = (char) => char !== undefined && char >= "0" && char <= "9";
const numberAt = (chars, from) => {
  let end = from;
  let value = 0;
  while (isDigit(chars[end])) {
    value = Math.min(value * 10 + Number(chars[end]), 1e6);
    end += 1;
  }
  return { value, end };
};
const quantifierAt = (chars, at) => {
  const char = chars[at];
  let end = at + 1;
  let repeats = true;
  let variable = true;
  if (char === "?")
    repeats = false;
  else if (char === "{") {
    const low = numberAt(chars, end);
    end = low.end;
    const ranged = chars[end] === ",";
    variable = false;
    if (ranged) {
      const high = numberAt(chars, end + 1);
      variable = high.end === end + 1 || high.value > low.value;
      end = high.end;
    }
    repeats = ranged || low.value > 1;
    end += 1;
  } else if (char !== "*" && char !== "+")
    return;
  return { end: chars[end] === "?" ? end + 1 : end, repeats, variable };
};
const escapeEnd = (chars, at) => {
  const kind = chars[at + 1];
  if ((kind === "p" || kind === "P" || kind === "u") && chars[at + 2] === "{") {
    const close = chars.indexOf("}", at + 3);
    return close === -1 ? chars.length : close + 1;
  }
  return at + 2;
};
const propertyRefusal = (chars, at) => {
  const kind = chars[at + 1];
  if (kind !== "p" && kind !== "P" || chars[at + 2] !== "{")
    return;
  const end = escapeEnd(chars, at);
  const name = chars.slice(at + 3, end - 1).join("");
  return propertyNameAllowed(name) ? undefined : `names the property ${name}, which is neither a General_Category value nor an ECMAScript 2018 binary property, so not every browser reads it`;
};
const classEnd = (chars, at) => {
  let each = at + 1;
  let refusal;
  while (each < chars.length && chars[each] !== "]") {
    if (chars[each] === "\\") {
      refusal ??= propertyRefusal(chars, each);
      each = escapeEnd(chars, each);
    } else
      each += 1;
  }
  return refusal === undefined ? { end: each + 1 } : { end: each + 1, refusal };
};
const groupHeader = (chars, at, names) => {
  if (chars[at + 1] !== "?")
    return { end: at + 1 };
  const kind = chars[at + 2];
  if (kind === "=" || kind === "!")
    return { refusal: "holds a lookahead", end: at + 3 };
  if (kind === ":")
    return { end: at + 3 };
  if (kind !== "<")
    return { refusal: MODIFIER, end: at + 2 };
  const sign = chars[at + 3];
  if (sign === "=" || sign === "!")
    return { refusal: "holds a lookbehind", end: at + 4 };
  const close = chars.indexOf(">", at + 3);
  const name = chars.slice(at + 3, close === -1 ? chars.length : close).join("");
  if (name.includes("\\"))
    return { refusal: `names a group with an escape (${name})`, end: at };
  if (names.has(name))
    return { refusal: `names the group ${name} twice`, end: at };
  names.add(name);
  return { end: close === -1 ? chars.length : close + 1 };
};
var MODIFIER = "holds a group form other than (?: and (?<name>, such as a modifier group, which not every browser reads";
var REPEATED = "holds a repeated group that itself holds a quantifier or an alternation, which can match in exponential time";
const patternProblem = (pattern) => {
  const chars = Array.from(pattern);
  if (chars.length > PATTERN_MAX_CHARS) {
    return `is ${chars.length} characters, over the limit of ${PATTERN_MAX_CHARS}`;
  }
  try {
    new RegExp(pattern, "u");
  } catch {
    return "does not compile as an ECMAScript regular expression with the u flag";
  }
  const groups = [];
  const names = new Set;
  let repeats = chars[0] === "^" ? 0 : 1;
  let topPiped = false;
  const top = () => groups[groups.length - 1];
  let at = 0;
  while (at < chars.length) {
    const char = chars[at];
    if (char === "\\") {
      const next = chars[at + 1];
      if (next === "k" || next !== undefined && next >= "1" && next <= "9") {
        return `holds a backreference (\\${next})`;
      }
      const refusal = propertyRefusal(chars, at);
      if (refusal !== undefined)
        return refusal;
      at = escapeEnd(chars, at);
    } else if (char === "[") {
      const inClass = classEnd(chars, at);
      if (inClass.refusal !== undefined)
        return inClass.refusal;
      at = inClass.end;
    } else if (char === "(") {
      const header = groupHeader(chars, at, names);
      if (header.refusal !== undefined)
        return header.refusal;
      groups.push({ quantifier: false, alternation: false, piped: false });
      at = header.end;
    } else if (char === ")") {
      const frame = groups.pop();
      const quantifier = quantifierAt(chars, at + 1);
      if (frame !== undefined && quantifier?.repeats && (frame.quantifier || frame.alternation)) {
        return REPEATED;
      }
      if (frame?.piped)
        repeats += 1;
      if (quantifier?.variable)
        repeats += 1;
      const parent = top();
      if (parent !== undefined && frame !== undefined) {
        parent.quantifier ||= frame.quantifier || quantifier !== undefined;
        parent.alternation ||= frame.alternation;
      }
      at = quantifier === undefined ? at + 1 : quantifier.end;
    } else if (char === "|") {
      const frame = top();
      if (frame === undefined)
        topPiped = true;
      else {
        frame.alternation = true;
        frame.piped = true;
      }
      at += 1;
    } else {
      const quantifier = quantifierAt(chars, at);
      if (quantifier === undefined)
        at += 1;
      else {
        const frame = top();
        if (frame !== undefined)
          frame.quantifier = true;
        if (quantifier.variable)
          repeats += 1;
        at = quantifier.end;
      }
    }
  }
  if (topPiped)
    repeats += 1;
  if (repeats > PATTERN_MAX_REPEATS) {
    return `costs ${repeats} repetitions, over the limit of ${PATTERN_MAX_REPEATS} (each ?, *, +, {n,} and {n,m}, each group holding a |, and no leading ^ count one)`;
  }
  return;
};

// packages/contract/src/widgets/text-field/constants.ts
var TEXT_FIELD_MAX_CHARS = 1e4;

// packages/contract/src/widgets/text-field/checks.ts
var KEYS5 = ["label", "description", "multiline", "maxLength", "required", "minLength", "pattern"];
const textWithin5 = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const textFieldPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a TextField's props are an object {label, ...}" }];
  }
  const problems = Object.keys(props).filter((key) => !KEYS5.includes(key)).map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path, message) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
  if (!textWithin5(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (props.description !== undefined && !textWithin5(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    at("/description", `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`);
  }
  if (props.multiline !== undefined && typeof props.multiline !== "boolean") {
    at("/multiline", "multiline is true or false");
  }
  const { maxLength } = props;
  if (maxLength !== undefined && !(Number.isInteger(maxLength) && maxLength >= 1 && maxLength <= TEXT_FIELD_MAX_CHARS)) {
    at("/maxLength", `maxLength is a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}`);
  }
  problems.push(...lengthProblems2(props), ...patternProblems(props));
  return problems;
};
const textFieldLimit = (props) => typeof props.maxLength === "number" ? props.maxLength : props.pattern === undefined ? TEXT_FIELD_MAX_CHARS : PATTERN_TEXT_MAX_CHARS;
const isWhole = (value, max) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
const lengthProblems2 = (props) => {
  const { minLength } = props;
  if (minLength === undefined)
    return [];
  if (!isWhole(minLength, TEXT_FIELD_MAX_CHARS)) {
    return [
      {
        path: "/minLength",
        message: `minLength is a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}`
      }
    ];
  }
  const limit = textFieldLimit(props);
  return minLength > limit ? [
    {
      path: "/minLength",
      message: `minLength ${minLength} is above the most the field holds, ${limit} characters`
    }
  ] : [];
};
const patternProblems = (props) => {
  const { pattern, maxLength } = props;
  if (pattern === undefined)
    return [];
  if (typeof pattern !== "string" || pattern === "") {
    return [
      {
        path: "/pattern",
        message: `the pattern is a text of 1 to ${PATTERN_MAX_CHARS} characters`
      }
    ];
  }
  const problems = [];
  const why = patternProblem(pattern);
  if (why !== undefined)
    problems.push({ path: "/pattern", message: `the pattern ${why}` });
  if (typeof maxLength === "number" && maxLength > PATTERN_TEXT_MAX_CHARS) {
    problems.push({
      path: "/maxLength",
      message: `a field with a pattern holds at most ${PATTERN_TEXT_MAX_CHARS} characters, and maxLength is ${maxLength}`
    });
  }
  return problems;
};
var LINE_BREAK = /[\n\r]/;
const textFieldResultProblems = (result, props) => {
  if (!isRecord(props) || textFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no TextField's, so its result cannot be checked"
      }
    ];
  }
  if (typeof result !== "string")
    return [];
  const limit = textFieldLimit(props);
  const count = codePointCount(result);
  const problems = [];
  if (count > limit) {
    problems.push({
      path: "/",
      message: `the text has ${count} characters, over the field's limit of ${limit}`
    });
  }
  if (props.multiline !== true && LINE_BREAK.test(result)) {
    problems.push({ path: "/", message: "the text holds a line break, and this field takes none" });
  }
  return problems;
};
const textFieldResultShape = (result) => textWithin5(result, TEXT_FIELD_MAX_CHARS);
const textFieldFieldCheck = (result, props) => {
  const required = requiredFailure(props, result);
  if (required !== undefined)
    return required;
  if (typeof result !== "string" || !isRecord(props))
    return;
  const { minLength } = props;
  return isWhole(minLength, TEXT_FIELD_MAX_CHARS) && codePointCount(result) < minLength ? { code: "min-length", min: minLength } : undefined;
};
var compiled = new Map;
var outcomes = new Map;
var FIELD_LAST = new WeakMap;

// packages/contract/src/widgets/toggle/checks.ts
const textWithin6 = (value, max) => typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;
const togglePropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Toggle's props are an object {label, description?}" }];
  }
  const problems = Object.keys(props).filter((key) => key !== "label" && key !== "description" && key !== "required").map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  problems.push(...requiredPropProblems(props));
  if (!textWithin6(props.label, ATOM_LABEL_MAX_CHARS)) {
    problems.push({
      path: "/label",
      message: `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`
    });
  }
  if (props.description !== undefined && !textWithin6(props.description, ATOM_DESCRIPTION_MAX_CHARS)) {
    problems.push({
      path: "/description",
      message: `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`
    });
  }
  return problems;
};
const toggleResultShape = (result) => typeof result === "boolean";
const toggleFieldCheck = (result, props) => requiredFailure(props, result);

// packages/contract/src/widgets/table/constants.ts
var TABLE_MAX_ROWS = 200;
var TABLE_MIN_COLUMNS = 1;
var TABLE_MAX_COLUMNS = 10;
var TABLE_TEXT_MAX_CHARS = 500;
var TABLE_FORMULA_MAX_CHARS = 500;
var TABLE_FIELD_PATTERN = "^(?!id$)[a-z][A-Za-z0-9]{0,63}$";
var TABLE_COLUMN_TYPES = /* @__PURE__ */ Object.freeze([
  "text",
  "number",
  "money",
  "date",
  "toggle"
]);
var TABLE_SHAPE = /* @__PURE__ */ Object.freeze({ elements: "rows" });

// packages/contract/src/widgets/table/projection.ts
var COLUMN_KEYS = new Set([
  "field",
  "label",
  "type",
  "formula",
  "total"
]);
var ATOM_KEYS = {
  text: ["maxLength"],
  number: ["min", "max", "step", "integer", "unit"],
  money: ["currency", "min", "max"],
  date: ["min", "max"],
  toggle: []
};
const isColumnType = (type) => typeof type === "string" && TABLE_COLUMN_TYPES.includes(type);
const pointer = (...parts) => parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
const projectionOf = (column, type) => {
  const keys = ["label", ...ATOM_KEYS[type]].filter((key) => Object.hasOwn(column, key));
  return Object.fromEntries(keys.map((key) => [key, column[key]]).filter(([, value]) => value !== undefined));
};

// packages/contract/src/widgets/table/cells.ts
var ID3 = new RegExp(ID_PATTERN);
const at = (message) => [{ path: "/", message }];
const flat = (problems) => problems.map(({ message }) => ({ path: "/", message }));
const tableCellProblems = (value, column) => {
  if (!isRecord(column) || !isColumnType(column.type)) {
    return at("the column is no column of a Table, so its cell cannot be checked");
  }
  const props = projectionOf(column, column.type);
  switch (column.type) {
    case "text": {
      if (typeof value !== "string" || !textFieldResultShape(value)) {
        return at(`a text cell holds text of 1 to ${TABLE_TEXT_MAX_CHARS} characters`);
      }
      const limit = typeof props.maxLength === "number" ? props.maxLength : TABLE_TEXT_MAX_CHARS;
      if (codePointCount(value) > Math.min(limit, TABLE_TEXT_MAX_CHARS)) {
        return at(`the text has ${codePointCount(value)} characters, over the column's limit of ${Math.min(limit, TABLE_TEXT_MAX_CHARS)}`);
      }
      return flat(textFieldResultProblems(value, props));
    }
    case "number":
      return typeof value === "number" && numberFieldResultShape(value) ? flat(numberFieldResultProblems(value, props)) : at("a number cell holds a number within a quadrillion either way");
    case "money": {
      const result = { amount: value, currency: props.currency };
      return typeof value === "string" && moneyFieldResultShape(result) ? flat(moneyFieldResultProblems(result, props)) : at("a money cell holds a decimal string of at most 15 integer digits and 4 decimals");
    }
    case "date":
      return typeof value === "string" && dateFieldResultShape(value) ? flat(dateFieldResultProblems(value, props)) : at("a date cell holds a full-date, as in 2026-03-31");
    case "toggle":
      return typeof value === "boolean" ? [] : at("a toggle cell holds true or false");
  }
};
const idProblems = (id, index, seen, origin) => {
  const path = pointer("rows", index, "id");
  if (typeof id !== "string")
    return [{ path, message: "a row has no ID" }];
  const problems = [];
  if (!ID3.test(id)) {
    problems.push({ path, message: `the ID ${JSON.stringify(id)} does not match ${ID_PATTERN}` });
  }
  if (seen.has(id))
    problems.push({ path, message: `the ID "${id}" is used by another row already` });
  seen.add(id);
  if (origin === "agent" && id.startsWith(VIEW_ID_PREFIX)) {
    problems.push({
      path,
      message: `the ID "${id}" starts with "${VIEW_ID_PREFIX}", which is reserved for IDs the board makes`
    });
  }
  return problems;
};
const cellsProblems = (row, index, columns) => {
  const id = typeof row.id === "string" ? row.id : String(index);
  return Object.keys(row).flatMap((field) => {
    if (field === "id")
      return [];
    const path = pointer("rows", index, field);
    const column = columns.byField.get(field);
    if (column === undefined) {
      return columns.declared.has(field) ? [] : [
        {
          path,
          message: `the row "${id}" holds the field "${field}", which no column declares`
        }
      ];
    }
    if (typeof column.formula === "string") {
      return [
        {
          path,
          message: `the row "${id}" holds the field "${field}", which its column computes by a formula: a row holds no value for it`
        }
      ];
    }
    return tableCellProblems(row[field], column).map(({ message }) => ({
      path,
      message: `the field "${field}" of the row "${id}": ${message}`
    }));
  });
};
const tableRowsProblems = (rows, columns, origin) => {
  if (!Array.isArray(rows))
    return [{ path: "/rows", message: "the rows are no list" }];
  if (rows.length > TABLE_MAX_ROWS) {
    return [
      {
        path: "/rows",
        message: `the Table holds ${rows.length} rows, over the limit of ${TABLE_MAX_ROWS} rows`
      }
    ];
  }
  const seen = new Set;
  const problems = [];
  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      problems.push({ path: pointer("rows", index), message: "a row is no object" });
      continue;
    }
    problems.push(...idProblems(row.id, index, seen, origin), ...cellsProblems(row, index, columns));
  }
  return problems;
};

// packages/contract/src/widgets/table/checks.ts
var FIELD = new RegExp(TABLE_FIELD_PATTERN);
var PROPS_KEYS = new Set(["label", "fixedRows", "columns", "rows"]);
var COMPUTED = ["number", "money", "date"];
var TOTALLED = ["number", "money"];
const atomProblems = (type, projection) => {
  switch (type) {
    case "text":
      return textFieldPropsProblems(projection);
    case "number":
      return numberFieldPropsProblems(projection);
    case "money":
      return moneyFieldPropsProblems(projection);
    case "date":
      return dateFieldPropsProblems(projection);
    case "toggle":
      return togglePropsProblems(projection);
  }
};
const repathed = (at, problems) => problems.map(({ path, message }) => ({
  path: pointer("columns", at) + (path === "/" ? "" : path),
  message
}));
const fieldProblems = (column, at, seen) => {
  const { field } = column;
  const path = pointer("columns", at, "field");
  if (typeof field !== "string")
    return [{ path, message: "a column has no field" }];
  if (!FIELD.test(field) || !isFieldName(field)) {
    return [
      {
        path,
        message: `the field ${JSON.stringify(field)} does not match ${TABLE_FIELD_PATTERN}: a lower-case letter, then letters and digits, never id`
      }
    ];
  }
  if (seen.has(field)) {
    return [{ path, message: `the field "${field}" is declared by another column already` }];
  }
  seen.add(field);
  return [];
};
const foreignKeyProblems = (column, type, at) => Object.keys(column).filter((key) => !COLUMN_KEYS.has(key) && !ATOM_KEYS[type].includes(key)).map((key) => ({ path: pointer("columns", at, key), message: `unknown field "${key}"` }));
const textBoundProblems = (column, type, at) => type === "text" && typeof column.maxLength === "number" && column.maxLength > TABLE_TEXT_MAX_CHARS ? [
  {
    path: pointer("columns", at, "maxLength"),
    message: `maxLength is a whole number from 1 to ${TABLE_TEXT_MAX_CHARS}, the most a Table's text cell holds`
  }
] : [];
const formulaProblems = (column, type, at) => {
  const { formula, total } = column;
  const problems = [];
  if (formula !== undefined) {
    const path = pointer("columns", at, "formula");
    if (!COMPUTED.includes(type)) {
      problems.push({
        path,
        message: `a ${type} column cannot be computed: a formula is for number, money and date columns`
      });
    } else if (typeof formula !== "string" || codePointCount(formula) < 1) {
      problems.push({
        path,
        message: `the formula is text of 1 to ${TABLE_FORMULA_MAX_CHARS} characters`
      });
    } else if (codePointCount(formula) > TABLE_FORMULA_MAX_CHARS) {
      problems.push({
        path,
        message: `the formula holds ${codePointCount(formula)} characters, over the limit of ${TABLE_FORMULA_MAX_CHARS}`
      });
    }
  }
  if (total !== undefined) {
    const path = pointer("columns", at, "total");
    if (!TOTALLED.includes(type)) {
      problems.push({
        path,
        message: `a ${type} column has no total: a total is for number and money columns`
      });
    } else if (total !== "sum") {
      problems.push({ path, message: 'the total is "sum", the only total a column has' });
    }
  }
  return problems;
};
const labelOk = (label) => typeof label === "string" && codePointCount(label) >= 1 && codePointCount(label) <= ATOM_LABEL_MAX_CHARS;
const labelProblem = (path) => ({
  path,
  message: `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`
});
const columnProblems = (column, at, seen) => {
  if (!isRecord(column)) {
    return {
      problems: [{ path: pointer("columns", at), message: "a column is no object" }],
      valid: false
    };
  }
  const problems = fieldProblems(column, at, seen);
  const { type } = column;
  if (!isColumnType(type)) {
    const message = `the column is of the type ${JSON.stringify(type ?? null)}, where a column is text, number, money, date or toggle`;
    problems.push({ path: pointer("columns", at, "type"), message });
    if (!labelOk(column.label))
      problems.push(labelProblem(pointer("columns", at, "label")));
    return { problems, valid: false };
  }
  problems.push(...foreignKeyProblems(column, type, at));
  const projection = projectionOf(column, type);
  const noCurrency = type === "money" && projection.currency === undefined;
  const fromAtom = atomProblems(type, projection).filter(({ path }) => !(noCurrency && path === "/currency"));
  problems.push(...repathed(at, fromAtom));
  if (noCurrency) {
    problems.push({
      path: pointer("columns", at, "currency"),
      message: "a money column has a currency, an ISO 4217 code of three capital letters"
    });
  }
  problems.push(...textBoundProblems(column, type, at), ...formulaProblems(column, type, at));
  return { problems, valid: problems.length === 0 };
};
const tableColumnsProblems = (columns) => {
  const byField = new Map;
  const declared = new Set;
  const held = { byField, declared };
  if (!Array.isArray(columns)) {
    return { problems: [{ path: "/columns", message: "the columns are no list" }], columns: held };
  }
  const problems = [];
  if (columns.length < TABLE_MIN_COLUMNS || columns.length > TABLE_MAX_COLUMNS) {
    problems.push({
      path: "/columns",
      message: `the Table holds ${columns.length} columns, and a Table has ${TABLE_MIN_COLUMNS} to ${TABLE_MAX_COLUMNS}`
    });
  }
  const seen = new Set;
  for (const [at, column] of columns.entries()) {
    const found = columnProblems(column, at, seen);
    problems.push(...found.problems);
    if (!isRecord(column) || typeof column.field !== "string")
      continue;
    declared.add(column.field);
    if (found.valid)
      byField.set(column.field, column);
  }
  return { problems, columns: held };
};
const tablePropsProblems = (props, origin) => {
  if (!isRecord(props)) {
    return [
      { path: "/", message: "a Table's props are an object {columns, rows, label?, fixedRows?}" }
    ];
  }
  const problems = Object.keys(props).filter((key) => !PROPS_KEYS.has(key)).map((key) => ({ path: pointer(key), message: `unknown field "${key}"` }));
  if (props.label !== undefined && !labelOk(props.label))
    problems.push(labelProblem("/label"));
  if (props.fixedRows !== undefined && props.fixedRows !== true) {
    problems.push({
      path: "/fixedRows",
      message: "fixedRows is true, or absent for a Table whose rows the user may add and delete"
    });
  }
  const { problems: fromColumns, columns } = tableColumnsProblems(props.columns);
  return [...problems, ...fromColumns, ...tableRowsProblems(props.rows, columns, origin)];
};

// packages/contract/src/widgets/table/derived.ts
var DECLARES = 'a Table declares the total of a column with a total as "<field>", and the field of a formula column of a row as "<row>.<field>"';
const columnsOf = (props) => isRecord(props) && Array.isArray(props.columns) ? props.columns.filter(isRecord) : [];
const fieldsWhere = (columns, has) => new Set(columns.filter((column) => typeof column.field === "string" && has(column)).map((column) => column.field));
const rowIds = (props) => new Set(isRecord(props) && Array.isArray(props.rows) ? props.rows.filter(isRecord).map((row) => row.id).filter((id) => typeof id === "string") : []);
const tableDerivedProblem = (rest, props) => {
  const columns = columnsOf(props);
  if (rest.length === 1) {
    const totals = fieldsWhere(columns, (column) => column.total === "sum");
    return totals.has(rest[0]) ? undefined : `"${rest[0]}" is no total of the Table: ${DECLARES}`;
  }
  if (rest.length === 2) {
    const [row, field] = rest;
    const computed = fieldsWhere(columns, (column) => typeof column.formula === "string");
    if (!rowIds(props).has(row))
      return `the Table has no row "${row}": ${DECLARES}`;
    return computed.has(field) ? undefined : `"${field}" is no formula column of the Table: ${DECLARES}`;
  }
  return DECLARES;
};
// packages/contract/src/widgets/table/table-changes.json
var table_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:table-changes",
  title: "Table changes",
  description: "A Table's changes (AD-20, FR-20, table-widget design decision 6): the output format's changes narrowed to three operations of the one generic diff on a flat list of rows keyed by ID, addressed as AD-13's reference syntax without brackets: add of a row, item.row, after the row it follows (none when first), its value an object of the fields of its input columns; remove of a row, item.row; set of a field of a row, item.row.field, the value of the field's type or null when the cell is emptied. A Table never moves a row, so a reordered value gives a move, which falls outside them, and a set of a computed column's field is never in a value the checks accept. In the output format since table-widget.",
  type: "array",
  items: {
    allOf: [
      {
        $ref: "urn:askboard:output:answer-event#/$defs/change"
      },
      {
        type: "object",
        properties: {
          op: {
            enum: ["add", "remove", "set"]
          }
        }
      },
      {
        if: {
          type: "object",
          properties: {
            op: {
              const: "add"
            }
          },
          required: ["op"]
        },
        then: {
          type: "object",
          properties: {
            target: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}$"
            },
            parent: false,
            value: {
              type: "object"
            }
          }
        }
      },
      {
        if: {
          type: "object",
          properties: {
            op: {
              const: "remove"
            }
          },
          required: ["op"]
        },
        then: {
          type: "object",
          properties: {
            target: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}$"
            }
          }
        }
      },
      {
        if: {
          type: "object",
          properties: {
            op: {
              const: "set"
            }
          },
          required: ["op"]
        },
        then: {
          type: "object",
          properties: {
            target: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}\\.(?!id$)[a-z][A-Za-z0-9]{0,63}$"
            },
            value: {
              anyOf: [
                {
                  type: "string",
                  minLength: 1,
                  maxLength: 500
                },
                {
                  type: "number",
                  minimum: -1000000000000000,
                  maximum: 1000000000000000
                },
                {
                  type: "boolean"
                },
                {
                  type: "null"
                }
              ]
            }
          }
        }
      }
    ]
  }
};
// packages/contract/src/widgets/table/table-props.json
var table_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:table-props",
  title: "Table props",
  description: "A Table item's props (FR-11, table-widget design decision 2): 1 to 10 columns, 0 to 200 rows, an optional label of 1 to 200 characters and an optional fixedRows true. A column holds a field, a label and a type (text, number, money, date or toggle) with only that type's keys: maxLength for text; min, max, step, integer and unit for number; a required currency, min and max for money; min and max for date. A formula (1 to 500 characters) is for number, money and date columns, a total of sum for number and money columns. A row holds its ID and, for each input column with a value, that value: a string for text, money (a decimal string) and date, a number for number, a boolean for toggle. What a schema cannot say (field names unique, the bounds as the input atoms check them, each cell against its column, row IDs unique, the view's prefix, no value for a formula column) is checked by tablePropsProblems. In the input format since table-widget.",
  type: "object",
  properties: {
    label: {
      type: "string",
      minLength: 1,
      maxLength: 200
    },
    fixedRows: {
      const: true
    },
    columns: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        $ref: "#/$defs/column"
      }
    },
    rows: {
      type: "array",
      maxItems: 200,
      items: {
        $ref: "#/$defs/row"
      }
    }
  },
  required: ["columns", "rows"],
  additionalProperties: false,
  $defs: {
    column: {
      description: "A column: a field (addressed item.row.field, AD-13; never id, never a spreadsheet cell), a label and a type, with the keys of its type only.",
      type: "object",
      properties: {
        field: {
          type: "string",
          pattern: "^(?!id$)[a-z][A-Za-z0-9]{0,63}$"
        },
        label: {
          type: "string",
          minLength: 1,
          maxLength: 200
        },
        type: {
          enum: ["text", "number", "money", "date", "toggle"]
        },
        formula: {
          type: "string",
          minLength: 1,
          maxLength: 500
        },
        total: {
          const: "sum"
        },
        maxLength: true,
        min: true,
        max: true,
        step: true,
        integer: true,
        unit: true,
        currency: true
      },
      required: ["field", "label", "type"],
      additionalProperties: false,
      if: {
        properties: {
          type: {
            const: "text"
          }
        },
        required: ["type"]
      },
      then: {
        properties: {
          maxLength: {
            type: "integer",
            minimum: 1,
            maximum: 500
          },
          formula: false,
          total: false,
          min: false,
          max: false,
          step: false,
          integer: false,
          unit: false,
          currency: false
        }
      },
      else: {
        if: {
          properties: {
            type: {
              const: "number"
            }
          },
          required: ["type"]
        },
        then: {
          properties: {
            min: {
              type: "number",
              minimum: -1000000000000000,
              maximum: 1000000000000000
            },
            max: {
              type: "number",
              minimum: -1000000000000000,
              maximum: 1000000000000000
            },
            step: {
              type: "number",
              exclusiveMinimum: 0,
              maximum: 2000000000000000
            },
            integer: {
              type: "boolean"
            },
            unit: {
              type: "string",
              minLength: 1,
              maxLength: 20
            },
            maxLength: false,
            currency: false
          }
        },
        else: {
          if: {
            properties: {
              type: {
                const: "money"
              }
            },
            required: ["type"]
          },
          then: {
            required: ["currency"],
            properties: {
              currency: {
                type: "string",
                pattern: "^[A-Z]{3}$"
              },
              min: {
                type: "string",
                pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$"
              },
              max: {
                type: "string",
                pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$"
              },
              maxLength: false,
              step: false,
              integer: false,
              unit: false
            }
          },
          else: {
            if: {
              properties: {
                type: {
                  const: "date"
                }
              },
              required: ["type"]
            },
            then: {
              properties: {
                min: {
                  $ref: "urn:askboard:input:gantt-props#/$defs/fullDate"
                },
                max: {
                  $ref: "urn:askboard:input:gantt-props#/$defs/fullDate"
                },
                total: false,
                maxLength: false,
                step: false,
                integer: false,
                unit: false,
                currency: false
              }
            },
            else: {
              properties: {
                formula: false,
                total: false,
                maxLength: false,
                min: false,
                max: false,
                step: false,
                integer: false,
                unit: false,
                currency: false
              }
            }
          }
        }
      }
    },
    row: {
      description: "A row: its ID (unique in the item) and a value for each input column that has one, absent when empty. A formula column's field is never a key.",
      type: "object",
      properties: {
        id: {
          $ref: "urn:askboard:input:id"
        }
      },
      patternProperties: {
        "^(?!id$)[a-z][A-Za-z0-9]{0,63}$": {
          $ref: "#/$defs/cell"
        }
      },
      required: ["id"],
      maxProperties: 11,
      additionalProperties: false
    },
    cell: {
      description: "A cell's value, by its column's type: a string of 1 to 500 characters (text; a money amount; a date), a number within a quadrillion either way, or a boolean.",
      anyOf: [
        {
          type: "string",
          minLength: 1,
          maxLength: 500
        },
        {
          type: "number",
          minimum: -1000000000000000,
          maximum: 1000000000000000
        },
        {
          type: "boolean"
        }
      ]
    }
  }
};

// packages/contract/src/widgets/table/wording.ts
var DECIMAL2 = "a decimal string of at most 15 integer digits and 4 decimals, as in 1040.00";
var TABLE_EXPECTED = {
  "table.props": "a Table's props {columns, rows, label?, fixedRows?}",
  "table.props.label": `${text(ATOM_LABEL_MAX_CHARS)}, the grid's caption`,
  "table.props.fixedRows": "true, to keep the rows the agent sent: the user edits their cells but adds and deletes none",
  "table.props.columns": `a list of ${TABLE_MIN_COLUMNS} to ${TABLE_MAX_COLUMNS} columns, each {field, label, type, and the keys of its type}`,
  "table.props.columns[]": "a column {field, label, type, formula?, total?, and the keys of its type}",
  "table.props.columns[].field": `a field name matching ${TABLE_FIELD_PATTERN}, never id, unique among the columns`,
  "table.props.columns[].label": text(ATOM_LABEL_MAX_CHARS),
  "table.props.columns[].type": '"text", "number", "money", "date" or "toggle"',
  "table.props.columns[].formula": `text of 1 to ${TABLE_FORMULA_MAX_CHARS} characters, for a number, money or date column: [@field] reads a field of the same row`,
  "table.props.columns[].total": '"sum", for a number or money column',
  "table.props.columns[].maxLength": `a whole number from 1 to ${TABLE_TEXT_MAX_CHARS}, for a text column`,
  "table.props.columns[].min": "the lowest value: a number for a number column, a decimal string for a money column, a full-date for a date column",
  "table.props.columns[].max": "the highest value, not below min: a number for a number column, a decimal string for a money column, a full-date for a date column",
  "table.props.columns[].step": "a number above 0, for a number column",
  "table.props.columns[].integer": "true or false, for a number column",
  "table.props.columns[].unit": `${text(ATOM_UNIT_MAX_CHARS)}, for a number column`,
  "table.props.columns[].currency": `an ISO 4217 code of three capital letters, as in USD, for a money column, which has one (${DECIMAL2} in each cell)`,
  "table.props.rows": `a list of at most ${TABLE_MAX_ROWS} rows, each {id, and a value for each input column that has one}`,
  "table.props.rows[]": "a row {id, and a value for each input column that has one}",
  "table.props.rows[].id": `${ID_SHAPE}, unique among the Table's rows`,
  "table.props.rows[].{field}": `a value for the field of an input column: text of 1 to ${TABLE_TEXT_MAX_CHARS} characters for a text column, a number for a number column, a decimal string for a money column, a full-date for a date column, true or false for a toggle column`
};
var TABLE_FIELDS = {
  "table.props": "a Table's props hold only columns, rows, label and fixedRows",
  "table.props.columns[]": "a column holds only field, label, type, formula, total and the keys of its type: maxLength, min, max, step, integer, unit and currency",
  "table.props.rows[]": "a row holds only id and the fields its input columns declare"
};
const tableRest = (rest) => {
  if (rest[1] !== "rows" || !isIndex(rest[2]))
    return rest;
  const [field] = rest.slice(3);
  return field !== undefined && field !== "id" && !isIndex(field) ? [...rest.slice(0, 3), "{field}"] : rest;
};
const tableElementOf = (item, rest) => {
  const key = rest[1];
  if (!isRecord(item) || key !== "columns" && key !== "rows" || !isIndex(rest[2])) {
    return;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const name = isRecord(element) ? element[key === "columns" ? "field" : "id"] : undefined;
  return typeof name === "string" ? `${key === "columns" ? "column" : "row"} "${name}"` : undefined;
};

// packages/contract/src/widgets/table/widget.ts
var TABLE_WIDGET = {
  type: "table",
  noun: "a Table",
  props: table_props_default,
  propsProblems: tablePropsProblems,
  edits: { changes: table_changes_default, shape: () => TABLE_SHAPE },
  derived: {
    describe: "each total, `item.field`, and each formula column's field of a row, `item.row.field`",
    problem: tableDerivedProblem
  },
  wording: {
    expected: TABLE_EXPECTED,
    fields: TABLE_FIELDS,
    rest: tableRest,
    element: tableElementOf
  },
  example: {
    item: {
      type: "table",
      id: "costs",
      props: {
        label: "Roles",
        columns: [
          { field: "role", label: "Role", type: "text" },
          { field: "days", label: "Days", type: "number", min: 0, total: "sum" },
          { field: "rate", label: "Rate", type: "money", currency: "USD" },
          {
            field: "amount",
            label: "Amount",
            type: "money",
            currency: "USD",
            formula: "[@days] * [@rate]",
            total: "sum"
          }
        ],
        rows: [
          { id: "pm", role: "Project manager", days: 18, rate: "1040.00" },
          { id: "dev", role: "Developer", days: 72, rate: "720.00" }
        ]
      }
    }
  },
  help: {
    mouse: "Click a cell to edit it, use Add row and Delete row in the toolbar, and click an on or off cell to switch it. Computed columns and totals are read-only.",
    answer: "The agent receives the cells you changed, the rows you added or deleted, and the totals and computed cells that follow from them."
  },
  skill: {
    use: "a grid of typed columns to edit, with totals and formula columns",
    notes: [
      "Columns (1 to 10, unique lower-case `field`): `text` (`maxLength`), `number` (`min`, `max`, `step`, `integer`, `unit`), `money` (`currency`; `min`, `max` as decimal strings), `date` (`min`, `max`), `toggle`. A row is `{id, <field>: value}`; money is a decimal string; leave an empty cell out.",
      'A column with a `formula` is computed and read-only: no value for it in a row. `[@field]` reads that field of the same row; a formula reads single fields only (no `*`, no range), at most 500 characters. `total: "sum"` on a number or money column adds a total that formulas read as `[item.field]`.',
      "`fixedRows: true` keeps your rows: the user edits cells but adds and deletes none. At most 200 rows. The answer gives the changes (`set` of `item.row.field`, `add`, `remove`) and the derived values: each total and the formula cells of rows that moved."
    ]
  }
};

// packages/contract/src/widgets/tabs/checks.ts
const tabsPropsProblems = (props) => {
  const tabs = isRecord(props) && Array.isArray(props.tabs) ? props.tabs : [];
  const seen = new Set;
  const problems = [];
  tabs.forEach((tab, index) => {
    const id = isRecord(tab) ? tab.id : undefined;
    if (typeof id !== "string")
      return;
    if (id.startsWith(VIEW_ID_PREFIX)) {
      problems.push({
        path: `/tabs/${index}/id`,
        message: `the tab ID "${id}" starts with "${VIEW_ID_PREFIX}", which the board keeps for the IDs it makes itself`
      });
    }
    if (seen.has(id)) {
      problems.push({
        path: `/tabs/${index}/id`,
        message: `the tab ID "${id}" is held twice: each tab of a Tabs layout has an ID of its own`
      });
    }
    seen.add(id);
  });
  return problems;
};
// packages/contract/src/widgets/tabs/tabs-props.json
var tabs_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:tabs-props",
  title: "Tabs props",
  description: "A Tabs item's props (FR-13, layouts design decision 1): 2 to 8 tabs, each with an ID, a title and at least one item, shown one panel at a time. Each item is an atom, a widget or a layout as the input format writes it. That the tab IDs are unique in the item and do not start with u- is checked by tabsPropsProblems. A Tabs layout gives no result. In the input format since layouts.",
  type: "object",
  properties: {
    tabs: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { $ref: "#/$defs/tab" }
    }
  },
  required: ["tabs"],
  additionalProperties: false,
  $defs: {
    tab: {
      description: "A tab: its ID, unique in the item, its title and the items of its panel.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        title: { type: "string", minLength: 1, maxLength: 80 },
        items: {
          type: "array",
          minItems: 1,
          items: { $ref: "urn:askboard:input:question-props#/$defs/layoutItem" }
        }
      },
      required: ["id", "title", "items"],
      additionalProperties: false
    }
  }
};

// packages/contract/src/widgets/tabs/constants.ts
var TABS_MIN_TABS = 2;
var TABS_MAX_TABS = 8;
var TABS_TITLE_MAX_CHARS = 80;

// packages/contract/src/widgets/tabs/wording.ts
var TABS_EXPECTED = {
  "tabs.props": "a Tabs layout's props {tabs}",
  "tabs.props.tabs": `a list of ${TABS_MIN_TABS} to ${TABS_MAX_TABS} tabs, each {id, title, items}`,
  "tabs.props.tabs[]": "a tab {id, title, items}",
  "tabs.props.tabs[].id": `${ID_SHAPE}, unique among the Tabs' tabs and not starting with "u-"`,
  "tabs.props.tabs[].title": text(TABS_TITLE_MAX_CHARS),
  "tabs.props.tabs[].items": "a non-empty list of the items the tab's panel holds",
  "tabs.props.tabs[].items[]": LAYOUT_CHILD_ITEM,
  "tabs.props.tabs[].items[].type": LAYOUT_CHILD_TYPE
};
var TABS_FIELDS = {
  "tabs.props": "a Tabs layout's props hold only tabs",
  "tabs.props.tabs[]": "a tab holds only id, title and items",
  "tabs.props.tabs[].items[]": LAYOUT_CHILD_FIELDS
};
const tabsElementOf = (item, rest) => {
  if (!isRecord(item) || rest[1] !== "tabs" || !isIndex(rest[2]))
    return;
  const props = Object.hasOwn(item, "props") ? item.props : undefined;
  const tabs = isRecord(props) && Array.isArray(props.tabs) ? props.tabs : undefined;
  const tab = tabs?.[Number(rest[2])];
  const id = isRecord(tab) ? tab.id : undefined;
  return typeof id === "string" ? `tab "${id}"` : undefined;
};

// packages/contract/src/widgets/tabs/widget.ts
var TABS_WIDGET = {
  type: "tabs",
  noun: "a Tabs layout",
  props: tabs_props_default,
  propsProblems: tabsPropsProblems,
  wording: { expected: TABS_EXPECTED, fields: TABS_FIELDS, element: tabsElementOf },
  example: {
    item: {
      type: "tabs",
      id: "arrange-tabs",
      props: {
        tabs: [
          {
            id: "costs",
            title: "Costs",
            items: [{ type: "number-field", id: "arrange-tabs-cost", props: { label: "Cost" } }]
          },
          {
            id: "notes",
            title: "Notes",
            items: [{ type: "text-field", id: "arrange-tabs-note", props: { label: "Note" } }]
          }
        ]
      }
    }
  },
  help: {
    mouse: "Click a tab to see its items; every tab keeps what you entered in it.",
    answer: "Nothing of its own: each item in a tab gives its own answer."
  },
  skill: {
    use: "2 to 8 titled tabs, each holding items",
    notes: [
      "Each tab is `{id, title, items}` with an ID unique in the Tabs; its items hold atoms, widgets and other layouts. The user sees one tab at a time, and every tab keeps its answers."
    ]
  }
};

// packages/contract/src/widgets/text/checks.ts
const textPropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Text's props are an object {text, format?}" }];
  }
  const problems = Object.keys(props).filter((key) => key !== "text" && key !== "format").map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const { text, format } = props;
  if (typeof text !== "string") {
    problems.push({ path: "/text", message: "the text is a text of 1 or more characters" });
  } else {
    const count = codePointCount(text);
    if (count < 1 || count > TEXT_MAX_CHARS) {
      problems.push({
        path: "/text",
        message: `the text has ${count} characters, and a Text holds 1 to ${TEXT_MAX_CHARS}`
      });
    }
  }
  if (format !== undefined && !TEXT_FORMATS.includes(format)) {
    problems.push({ path: "/format", message: `the format is "plain" or "markdown"` });
  }
  return problems;
};
// packages/contract/src/widgets/text/text-props.json
var text_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:text-props",
  title: "Text props",
  description: "A Text item's props (FR-13, atoms design decision 1): 1 to 10000 characters of text, plain (the default) or Markdown, which the board shows as data and never as markup. It gives no result. In the input format since atoms.",
  type: "object",
  properties: {
    text: { type: "string", minLength: 1, maxLength: 1e4 },
    format: { enum: ["plain", "markdown"] }
  },
  required: ["text"],
  additionalProperties: false
};

// packages/contract/src/widgets/text/wording.ts
var TEXT_EXPECTED = {
  "text.props": "a Text's props {text, format?}",
  "text.props.text": text(TEXT_MAX_CHARS),
  "text.props.format": '"plain" (the default) or "markdown"'
};
var TEXT_FIELDS = {
  "text.props": "a Text's props hold only text and format"
};

// packages/contract/src/widgets/text/widget.ts
var TEXT_WIDGET = {
  type: "text",
  noun: "a Text",
  props: text_props_default,
  propsProblems: textPropsProblems,
  wording: { expected: TEXT_EXPECTED, fields: TEXT_FIELDS },
  example: {
    item: {
      type: "text",
      id: "intro",
      props: { text: "The budget below covers **Q3** only.", format: "markdown" }
    }
  },
  help: {
    mouse: "Read it: there is nothing to click or type.",
    answer: "Nothing: a passage of text is for reading and gives no answer."
  },
  skill: {
    use: "a passage of plain text or Markdown the user reads; it gives no answer",
    notes: [
      "`format` is `plain` (the default) or `markdown`. Markdown is shown as data: raw HTML never renders, only http and https links open, and an image shows as a link to its source."
    ]
  }
};
// packages/contract/src/widgets/text-field/text-field-props.json
var text_field_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:text-field-props",
  title: "TextField props",
  description: "A TextField item's props (FR-13, atoms design decision 1): a label of 1 to 200 characters, an optional description of 1 to 1000, an optional multiline and an optional maxLength from 1 to 10000 (10000 when absent), counted in characters (code points). `required` since form-widget, and `minLength` and `pattern`: a minimum of 1 to 10000 characters, and a pattern of 1 to 200 characters that checks.ts holds to the safe subset. In the input format since atoms.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    multiline: { type: "boolean" },
    maxLength: { type: "integer", minimum: 1, maximum: 1e4 },
    minLength: { type: "integer", minimum: 1, maximum: 1e4 },
    pattern: { type: "string", minLength: 1, maxLength: 200 },
    required: { type: "boolean" }
  },
  required: ["label"],
  additionalProperties: false
};
// packages/contract/src/widgets/text-field/text-field-result.json
var text_field_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:text-field-result",
  title: "TextField result",
  description: "A TextField's result (FR-13, FR-18, atoms design decision 1): the text the user typed, 1 to 10000 characters, never empty. That it fits the item's maxLength and holds no line break unless the item is multiline are checks of the type against the item's props. In the output format since atoms.",
  type: "string",
  minLength: 1,
  maxLength: 1e4
};

// packages/contract/src/widgets/text-field/wording.ts
var TEXT_FIELD_EXPECTED = {
  "text-field.props": "a TextField's props {label, description?, required?, multiline?, minLength?, maxLength?, pattern?}",
  "text-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "text-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "text-field.props.required": "true, for a field that must hold a value before the question is answered",
  "text-field.props.multiline": "true, for a field whose text may hold line breaks",
  "text-field.props.minLength": `a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}, the fewest characters the text may hold, not above the most it holds`,
  "text-field.props.pattern": `a regular expression of 1 to ${PATTERN_MAX_CHARS} characters, read with the u flag and unanchored, that the text must match: no backreference, lookahead or lookbehind, no group form but (?: and (?<name>, no \\p{…} but a General_Category value or an ECMAScript 2018 binary property, no repeated group holding a quantifier or a |, and at most ${PATTERN_MAX_REPEATS} repetitions (each ?, *, +, {n,} or {n,m}, each group holding a |, and one more with no leading ^); a field with a pattern holds at most ${PATTERN_TEXT_MAX_CHARS} characters`,
  "text-field.props.maxLength": `a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}, the most characters the text may hold, ${TEXT_FIELD_MAX_CHARS} when absent`
};
var TEXT_FIELD_FIELDS = {
  "text-field.props": "a TextField's props hold only label, description, required, multiline, minLength, maxLength and pattern"
};

// packages/contract/src/widgets/text-field/widget.ts
var TEXT_FIELD_WIDGET = {
  type: "text-field",
  noun: "a TextField",
  props: text_field_props_default,
  propsProblems: textFieldPropsProblems,
  fieldCheck: textFieldFieldCheck,
  result: {
    schema: text_field_result_default,
    shape: textFieldResultShape,
    problems: textFieldResultProblems
  },
  wording: { expected: TEXT_FIELD_EXPECTED, fields: TEXT_FIELD_FIELDS },
  example: {
    item: {
      type: "text-field",
      id: "reviewer",
      props: {
        label: "Reviewer's name",
        description: "As it should appear in the log.",
        maxLength: 80
      }
    }
  },
  help: {
    mouse: "Click the box and type; a long text allows line breaks.",
    answer: "The agent receives the text you typed. An empty field gives no answer."
  },
  skill: {
    use: "a short or long free text the user types, such as a name or a comment",
    notes: [
      "`multiline` allows line breaks; `maxLength` (up to 10,000 characters) caps the text. The result is the text itself, and an empty field gives none.",
      "`minLength` sets the fewest characters; `required` makes an answer wait for a value. `pattern` must be matched by the text, unanchored; a field with a `pattern` holds at most " + String(PATTERN_TEXT_MAX_CHARS) + " characters.",
      "A `pattern` is a regular expression with no backreference, lookaround or repeated group holding a quantifier or a `|`, and at most " + String(PATTERN_MAX_REPEATS) + " repetitions: each `?`, `*`, `+`, `{n,}`, `{n,m}`, group holding a `|` and a missing leading `^` counts one. `\\p{…}` names a category (`L`), not a script."
    ]
  }
};

// packages/contract/src/widgets/timeline/checks.ts
var DAYS4 = `a day from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
var DATE_FIELDS = ["date", "start", "end"];
const entriesOf2 = (props, key) => {
  const list = props[key];
  if (!Array.isArray(list))
    return [];
  return list.flatMap((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    return typeof id === "string" ? [{ id, path: `/${key}/${index}` }] : [];
  });
};
const idProblems2 = (lanes, entries) => {
  const seen = new Set;
  const problems = [];
  const kind = new Map([
    ...lanes.map((lane) => [lane, "lane"]),
    ...entries.map((entry) => [entry, "entry"])
  ]);
  for (const [{ id, path }, noun] of kind) {
    if (seen.has(id)) {
      problems.push({
        path: `${path}/id`,
        message: `the ID "${id}" is held twice: each lane and entry of a Timeline has an ID of its own (${noun} "${id}")`
      });
    }
    seen.add(id);
  }
  return problems;
};
const entryProblems = (entry, path, lanes) => {
  const problems = [];
  const name = `entry "${String(entry.id)}"`;
  const at = (field, message) => problems.push({ path: `${path}${field}`, message: `${name}: ${message}` });
  if (typeof entry.lane === "string" && !lanes.has(entry.lane)) {
    at("/lane", `its lane "${entry.lane}" is no lane of the item`);
  }
  const held = DATE_FIELDS.filter((field) => entry[field] !== undefined);
  const isMilestone = held.length === 1 && held[0] === "date";
  const isRange = held.length === 2 && held[0] === "start" && held[1] === "end";
  if (!isMilestone && !isRange) {
    at("", "an entry holds `date` alone, a milestone, or `start` and `end`, a range");
  }
  for (const field of held) {
    const value = entry[field];
    if (typeof value === "string" && !isGanttDate(value)) {
      at(`/${field}`, `${field} ${JSON.stringify(value)} is not ${DAYS4}`);
    }
  }
  const { start, end } = entry;
  if (isGanttDate(start) && isGanttDate(end) && end < start) {
    at("/end", `the end ${end} is before the start ${start}`);
  }
  return problems;
};
const timelinePropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Timeline's props are an object {lanes, entries}" }];
  }
  const lanes = entriesOf2(props, "lanes");
  const entries = entriesOf2(props, "entries");
  const held = new Set(lanes.map(({ id }) => id));
  const list = Array.isArray(props.entries) ? props.entries : [];
  return [
    ...idProblems2(lanes, entries),
    ...list.flatMap((entry, index) => isRecord(entry) ? entryProblems(entry, `/entries/${index}`, held) : [])
  ];
};

// packages/contract/src/widgets/timeline/constants.ts
var TIMELINE_MIN_LANES = 1;
var TIMELINE_MAX_LANES = 20;
var TIMELINE_MIN_ENTRIES = 1;
var TIMELINE_MAX_ENTRIES = 200;
var TIMELINE_LANE_LABEL_MAX_CHARS = 60;
var TIMELINE_ENTRY_LABEL_MAX_CHARS = 200;
var TIMELINE_SHAPE = /* @__PURE__ */ Object.freeze({ elements: "entries" });

// packages/contract/src/widgets/timeline/keys.ts
var ENTRIES = "entries";
var TOOLBAR3 = "toolbar";
var TIMELINE_KEYS = [
  vocabularyEntry("cursor.up", ENTRIES, "navigation"),
  vocabularyEntry("cursor.down", ENTRIES, "navigation"),
  vocabularyEntry("cursor.first", ENTRIES, "navigation"),
  vocabularyEntry("cursor.last", ENTRIES, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR3, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.next", TOOLBAR3, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.first", TOOLBAR3, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.last", TOOLBAR3, "navigation", { readOnly: false }),
  ownEntry("timeline.moveEarlier", TOOLBAR3, [], "tool", {
    readOnly: false,
    label: "timeline.moveEarlier"
  }),
  ownEntry("timeline.moveLater", TOOLBAR3, [], "tool", {
    readOnly: false,
    label: "timeline.moveLater"
  }),
  ownEntry("timeline.moveToLane", TOOLBAR3, [], "menu", {
    readOnly: false,
    label: "timeline.moveToLane"
  })
];
// packages/contract/src/widgets/timeline/timeline-changes.json
var timeline_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:timeline-changes",
  title: "Timeline changes",
  description: "A Timeline's changes (AD-20, FR-20, latex-kanban-timeline design decision 5): set operations of the one generic diff on an entry's lane, date, start or end, addressed as item.entry.field (AD-13's reference syntax without brackets): a lane's ID for lane, a full-date for the others, never null, so no day can be taken away. A Timeline never adds, removes or moves an entry, edits a label or changes a lane. Whether a moved range keeps its length is no check of the changes. In the output format since latex-kanban-timeline.",
  type: "array",
  items: { $ref: "#/$defs/set" },
  $defs: {
    set: {
      type: "object",
      properties: {
        op: { const: "set" },
        target: {
          type: "string",
          pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}\\.(lane|date|start|end)$"
        },
        value: { type: "string" }
      },
      required: ["op", "target", "value"],
      additionalProperties: false,
      allOf: [
        {
          if: { properties: { target: { type: "string", pattern: "\\.lane$" } } },
          then: { properties: { value: { $ref: "urn:askboard:input:id" } } }
        },
        {
          if: {
            properties: { target: { type: "string", pattern: "\\.(date|start|end)$" } }
          },
          then: {
            properties: { value: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" } }
          }
        }
      ]
    }
  }
};
// packages/contract/src/widgets/timeline/timeline-props.json
var timeline_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:timeline-props",
  title: "Timeline props",
  description: "A Timeline item's props (FR-11, latex-kanban-timeline design decision 5): 1 to 20 lanes and 1 to 200 entries, each entry in a lane and either a milestone with a date or a range with a start and an inclusive end. Dates are the Gantt's full-dates. That the IDs are unique within the item, that each entry's lane is one of the item's lanes, that an entry holds a date alone or a start and an end, that the days exist within the Gantt's days and that an end is not before its start are checked by timelinePropsProblems. In the input format since latex-kanban-timeline.",
  type: "object",
  properties: {
    lanes: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { $ref: "#/$defs/lane" }
    },
    entries: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: { $ref: "#/$defs/entry" }
    }
  },
  required: ["lanes", "entries"],
  additionalProperties: false,
  $defs: {
    lane: {
      description: "A lane: its ID, unique in the item, and its label.",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 60 }
      },
      required: ["id", "label"],
      additionalProperties: false
    },
    entry: {
      description: "An entry: its ID, unique in the item, its label, the ID of its lane and its days: date alone for a milestone, start and end for a range (the rule is a check, so that its problem is one worded message).",
      type: "object",
      properties: {
        id: { $ref: "urn:askboard:input:id" },
        label: { type: "string", minLength: 1, maxLength: 200 },
        lane: { $ref: "urn:askboard:input:id" },
        date: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" },
        start: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" },
        end: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" }
      },
      required: ["id", "label", "lane"],
      additionalProperties: false
    }
  }
};

// packages/contract/src/widgets/timeline/wording.ts
var DAY2 = `a day as YYYY-MM-DD, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
var TIMELINE_EXPECTED = {
  "timeline.props": "a Timeline's props {lanes, entries}",
  "timeline.props.lanes": `a list of ${TIMELINE_MIN_LANES} to ${TIMELINE_MAX_LANES} lanes, each {id, label}`,
  "timeline.props.lanes[]": "a lane {id, label}",
  "timeline.props.lanes[].id": `${ID_SHAPE}, unique among the Timeline's lanes and entries`,
  "timeline.props.lanes[].label": text(TIMELINE_LANE_LABEL_MAX_CHARS),
  "timeline.props.entries": `a list of ${TIMELINE_MIN_ENTRIES} to ${TIMELINE_MAX_ENTRIES} entries, each {id, label, lane, date} for a milestone or {id, label, lane, start, end} for a range`,
  "timeline.props.entries[]": "an entry {id, label, lane, date} or {id, label, lane, start, end}: date alone, or start and end",
  "timeline.props.entries[].id": `${ID_SHAPE}, unique among the Timeline's lanes and entries`,
  "timeline.props.entries[].label": text(TIMELINE_ENTRY_LABEL_MAX_CHARS),
  "timeline.props.entries[].lane": `${ID_SHAPE}, the ID of one of the Timeline's lanes`,
  "timeline.props.entries[].date": `${DAY2}, a milestone's day`,
  "timeline.props.entries[].start": `${DAY2}, a range's first day`,
  "timeline.props.entries[].end": `${DAY2}, a range's last day, inclusive, on or after start`
};
var TIMELINE_FIELDS = {
  "timeline.props": "a Timeline's props hold only lanes and entries",
  "timeline.props.lanes[]": "a lane holds only id and label",
  "timeline.props.entries[]": "an entry holds only id, label, lane, date, start and end"
};
const timelineElementOf = (item, rest) => {
  const key = rest[1];
  if (!isRecord(item) || key !== "entries" && key !== "lanes" || !isIndex(rest[2])) {
    return;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `${key === "entries" ? "entry" : "lane"} "${id}"` : undefined;
};

// packages/contract/src/widgets/timeline/widget.ts
var TIMELINE_WIDGET = {
  type: "timeline",
  noun: "a Timeline",
  props: timeline_props_default,
  propsProblems: timelinePropsProblems,
  edits: { changes: timeline_changes_default, shape: () => TIMELINE_SHAPE },
  wording: {
    expected: TIMELINE_EXPECTED,
    fields: TIMELINE_FIELDS,
    element: timelineElementOf
  },
  example: {
    item: {
      type: "timeline",
      id: "roadmap",
      props: {
        lanes: [
          { id: "web", label: "Web" },
          { id: "mobile", label: "Mobile" }
        ],
        entries: [
          {
            id: "checkout",
            label: "New checkout",
            lane: "web",
            start: "2026-01-05",
            end: "2026-02-27"
          },
          { id: "launch", label: "Public launch", lane: "mobile", date: "2026-03-02" }
        ]
      }
    }
  },
  keys: TIMELINE_KEYS,
  help: {
    mouse: "Drag an entry along the time axis or into another lane (Escape cancels the drag), or make it current and use Move earlier, Move later or Move to lane….",
    answer: "The agent receives the dates and lanes you changed, entry by entry."
  },
  skill: {
    use: "milestones and date ranges the user moves in time and across lanes, as in a roadmap",
    notes: [
      "An entry is a milestone with `date` or a range with `start` and `end` (inclusive), in a `lane`; the answer's changes are `set`s of `lane`, `date`, `start` and `end`."
    ]
  }
};
// packages/contract/src/widgets/toggle/toggle-props.json
var toggle_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:toggle-props",
  title: "Toggle props",
  description: "A Toggle item's props (FR-13, atoms design decision 1): a label of 1 to 200 characters and an optional description of 1 to 1000. It starts unset. `required` since form-widget. In the input format since atoms.",
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 1000 },
    required: { type: "boolean" }
  },
  required: ["label"],
  additionalProperties: false
};
// packages/contract/src/widgets/toggle/toggle-result.json
var toggle_result_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:toggle-result",
  title: "Toggle result",
  description: "A Toggle's result (FR-13, FR-18, atoms design decision 1): true or false. False is an answer, and an untouched Toggle gives none. In the output format since atoms.",
  type: "boolean"
};

// packages/contract/src/widgets/toggle/wording.ts
var TOGGLE_EXPECTED = {
  "toggle.props": "a Toggle's props {label, description?, required?}",
  "toggle.props.label": text(ATOM_LABEL_MAX_CHARS),
  "toggle.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "toggle.props.required": "true, for a field that must hold a value before the question is answered"
};
var TOGGLE_FIELDS = {
  "toggle.props": "a Toggle's props hold only label, description and required"
};

// packages/contract/src/widgets/toggle/widget.ts
var TOGGLE_WIDGET = {
  type: "toggle",
  noun: "a Toggle",
  props: toggle_props_default,
  propsProblems: togglePropsProblems,
  fieldCheck: toggleFieldCheck,
  result: { schema: toggle_result_default, shape: toggleResultShape },
  wording: { expected: TOGGLE_EXPECTED, fields: TOGGLE_FIELDS },
  example: {
    item: {
      type: "toggle",
      id: "notify",
      props: { label: "Notify me when it ships" }
    }
  },
  help: {
    mouse: "Click it to switch it on or off; Clear takes your choice back.",
    answer: "The agent receives on or off. Off is an answer; a switch you did not touch gives none."
  },
  skill: {
    use: "an on or off choice the user sets, such as a switch or a yes or no",
    notes: [
      "The result is `true` or `false`; `false` is an answer. A Toggle the user leaves untouched gives no result."
    ]
  }
};

// packages/contract/src/widgets/tree/keys.ts
var GRID2 = "grid";
var EDITOR2 = "editor";
var TOOLBAR4 = "toolbar";
var PLAIN_DELETE = [keyBinding("Delete"), keyBinding("Backspace")];
var TREE_KEYS = [
  vocabularyEntry("cursor.up", GRID2, "navigation"),
  vocabularyEntry("cursor.down", GRID2, "navigation"),
  vocabularyEntry("cursor.left", GRID2, "navigation"),
  vocabularyEntry("cursor.right", GRID2, "navigation"),
  vocabularyEntry("cursor.first", GRID2, "navigation"),
  vocabularyEntry("cursor.last", GRID2, "navigation"),
  vocabularyEntry("edit.start", GRID2, "pointer"),
  vocabularyEntry("select.toggle", GRID2, "pointer"),
  vocabularyEntry("select.extendUp", GRID2, "pointer"),
  vocabularyEntry("select.extendDown", GRID2, "pointer"),
  vocabularyEntry("undo", GRID2, "tool", { label: "tree.tool.undoAdjust" }),
  vocabularyEntry("move.up", GRID2, "tool", { label: "tree.tool.moveUp" }),
  vocabularyEntry("move.down", GRID2, "tool", { label: "tree.tool.moveDown" }),
  vocabularyEntry("move.right", GRID2, "tool", { label: "tree.tool.indent" }),
  vocabularyEntry("move.left", GRID2, "tool", { label: "tree.tool.outdent" }),
  vocabularyEntry("delete", GRID2, "tool", { label: "tree.tool.remove", keys: PLAIN_DELETE }),
  vocabularyEntry("edit.commit", EDITOR2, "navigation"),
  vocabularyEntry("edit.cancel", EDITOR2, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR4, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR4, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR4, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR4, "navigation"),
  ownEntry("tree.addAfter", TOOLBAR4, [], "tool", {
    readOnly: false,
    label: "tree.tool.addAfter"
  }),
  ownEntry("tree.addChild", TOOLBAR4, [], "tool", {
    readOnly: false,
    label: "tree.tool.addChild"
  }),
  ownEntry("tree.selectAll", TOOLBAR4, [], "tool", { readOnly: false, label: "tree.select.all" }),
  ownEntry("tree.selectNone", TOOLBAR4, [], "tool", { readOnly: false, label: "tree.select.none" }),
  ownEntry("tree.adjust", TOOLBAR4, [], "tool", { readOnly: false, label: "tree.tool.adjust" }),
  ownEntry("tree.cancelDelete", "delete-question", [keyBinding("Escape")], "navigation", {
    readOnly: false,
    label: "tree.delete.cancel"
  }),
  ownEntry("tree.cancelGroup", "group-question", [keyBinding("Escape")], "navigation", {
    readOnly: false,
    label: "tree.group.cancel"
  })
];

// packages/contract/src/widgets/tree/index.ts
var TREE_SHAPE = {
  elements: "nodes",
  children: "children"
};
var TREE_MAX_NODES = 500;
var TREE_MAX_DEPTH = 8;
var TREE_MAX_COLUMNS = 8;
var TREE_LABEL_MAX_CHARS = 200;
var TREE_TEXT_MAX_CHARS = 1000;
var TREE_PERT_MAX_ESTIMATE = 1e5;
var TREE_PERT_DERIVED = /* @__PURE__ */ Object.freeze({
  node: Object.freeze(["expected", "spread"]),
  item: Object.freeze(["expected", "spread"])
});
var TREE_PERT_ANSWER_DERIVED = /* @__PURE__ */ Object.freeze({
  fields: TREE_PERT_DERIVED.node,
  decimals: 2,
  itemTotals: true,
  onlyChanged: true
});
var TREE_FIELD_PATTERN = "^[a-z][A-Za-z0-9]{0,63}$";

// packages/contract/src/molecules/pointer.ts
const pointerOf = (tokens) => tokens.map((token) => `/${String(token).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

// packages/contract/src/widgets/tree/pert.ts
var RANGE = `where an estimate is 0 to ${TREE_PERT_MAX_ESTIMATE.toLocaleString("en-US")} working days`;
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const columnProblems2 = (columns) => GANTT_PLAN_ESTIMATES.flatMap((field) => {
  const type = columns.get(field);
  if (type === "number")
    return [];
  const why = columns.has(field) ? `its column is ${type ?? "of no known type"}` : "no column declares it";
  const message = `a work breakdown with pert declares "${field}" as a number column, and ${why}`;
  return [{ path: "/pert", message }];
});
const estimateProblems = (list, at, level) => {
  if (!Array.isArray(list))
    return [];
  return list.flatMap((node, index) => {
    if (!isObject(node))
      return [];
    const path = [...at, index];
    const own = GANTT_PLAN_ESTIMATES.flatMap((field) => {
      const value = node[field];
      if (typeof value !== "number" || !Number.isFinite(value))
        return [];
      if (value >= 0 && value <= TREE_PERT_MAX_ESTIMATE)
        return [];
      const message = `the estimate "${field}" of the node "${String(node.id)}" is ${value}, ${RANGE}`;
      return [{ path: pointerOf([...path, field]), message }];
    });
    if (level > TREE_MAX_DEPTH)
      return own;
    return [...own, ...estimateProblems(node.children, [...path, "children"], level + 1)];
  });
};
const depthProblems = (openDepth, pert) => {
  if (openDepth === undefined)
    return [];
  const whole = typeof openDepth === "number" && Number.isInteger(openDepth) && openDepth >= 1 && openDepth <= TREE_MAX_DEPTH;
  if (!whole) {
    const message = `openDepth is a whole number of levels from 1 to ${TREE_MAX_DEPTH}`;
    return [{ path: "/openDepth", message }];
  }
  if (pert === true)
    return [];
  const message = "openDepth needs pert: a Tree without pert opens fully expanded";
  return [{ path: "/openDepth", message }];
};
const treePertProblems = (props, columns) => {
  const { pert, openDepth } = props;
  const problems = depthProblems(openDepth, pert);
  if (pert === undefined)
    return problems;
  if (pert !== true) {
    const message = "pert is true when given: a Tree without it computes nothing";
    return [{ path: "/pert", message }, ...problems];
  }
  return [...problems, ...columnProblems2(columns), ...estimateProblems(props.nodes, ["nodes"], 1)];
};

// packages/contract/src/widgets/tree/checks.ts
var NODE_KEYS = new Set(["id", "label", "children"]);
const isObject2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const pointer2 = (...parts) => parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
const isName = (value) => typeof value === "string" && value !== "";
const overLimit = (text, limit) => {
  const length = [...text].length;
  return length > limit ? `holds ${length} characters, over the limit of ${limit}` : undefined;
};
const valueFault = (type, value) => {
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? undefined : "takes a number";
  }
  if (!isName(value))
    return `takes text of 1 to ${TREE_TEXT_MAX_CHARS} characters`;
  return overLimit(value, TREE_TEXT_MAX_CHARS);
};
const nameProblems = (label, path, whose) => {
  if (!isName(label))
    return [{ path: pointer2(...path), message: `${whose} has no name` }];
  const over = overLimit(label, TREE_LABEL_MAX_CHARS);
  return over === undefined ? [] : [{ path: pointer2(...path), message: `the name of ${whose} ${over}` }];
};
const isColumnType2 = (type) => type === "text" || type === "number";
const columnProblems3 = (column, at, columns) => {
  if (!isObject2(column))
    return [{ path: pointer2("columns", at), message: "a column is no object" }];
  const { field, label, type } = column;
  if (typeof field !== "string") {
    return [{ path: pointer2("columns", at, "field"), message: "a column has no field" }];
  }
  const problems = nameProblems(label, ["columns", at, "label"], `the column "${field}"`);
  if (!isColumnType2(type)) {
    const message = `the column "${field}" is of the type ${JSON.stringify(type ?? null)}, where a column is text or number`;
    problems.push({ path: pointer2("columns", at, "type"), message });
  }
  if (columns.has(field)) {
    const message = `the field "${field}" is declared by another column already`;
    problems.push({ path: pointer2("columns", at, "field"), message });
  } else {
    columns.set(field, isColumnType2(type) ? type : undefined);
  }
  return problems;
};
const idProblems3 = (walk, id, path) => {
  const problems = [];
  if (walk.seen.has(id)) {
    const message = `the ID "${id}" is used by another node already`;
    problems.push({ path: pointer2(...path, "id"), message });
  }
  walk.seen.add(id);
  if (walk.origin === "agent" && id.startsWith(VIEW_ID_PREFIX)) {
    const message = `the ID "${id}" starts with "${VIEW_ID_PREFIX}", which is reserved for IDs the board makes`;
    problems.push({ path: pointer2(...path, "id"), message });
  }
  return problems;
};
const fieldProblems2 = (columns, node, id, path) => Object.entries(node).flatMap(([field, value]) => {
  if (NODE_KEYS.has(field))
    return [];
  if (!columns.has(field)) {
    const message = `the node "${id}" holds the field "${field}", which no column declares`;
    return [{ path: pointer2(...path, field), message }];
  }
  const type = columns.get(field);
  const fault = type === undefined ? undefined : valueFault(type, value);
  const message = `the field "${field}" of the node "${id}" ${fault}`;
  return fault === undefined ? [] : [{ path: pointer2(...path, field), message }];
});
const walkNodes = (walk, list, level, at) => {
  list.forEach((node, index) => {
    const path = [...at, index];
    walk.count += 1;
    if (!isObject2(node)) {
      walk.problems.push({ path: pointer2(...path), message: "a node is no object" });
      return;
    }
    const { id, label, children } = node;
    if (typeof id !== "string") {
      walk.problems.push({ path: pointer2(...path, "id"), message: "a node has no ID" });
      return;
    }
    walk.problems.push(...idProblems3(walk, id, path), ...nameProblems(label, [...path, "label"], `the node "${id}"`), ...fieldProblems2(walk.columns, node, id, path));
    if (level > TREE_MAX_DEPTH) {
      const message = `the node "${id}" sits at level ${level}, deeper than the limit of ${TREE_MAX_DEPTH} levels`;
      walk.problems.push({ path: pointer2(...path), message });
      return;
    }
    if (children === undefined)
      return;
    if (!Array.isArray(children)) {
      const message = `the children of the node "${id}" are no list`;
      walk.problems.push({ path: pointer2(...path, "children"), message });
      return;
    }
    walkNodes(walk, children, level + 1, [...path, "children"]);
  });
};
const treePropsProblems = (props, origin) => {
  if (!isObject2(props))
    return [{ path: "/", message: "a Tree's props are an object" }];
  const problems = [];
  const columns = new Map;
  if (Array.isArray(props.columns)) {
    props.columns.forEach((column, at) => {
      problems.push(...columnProblems3(column, at, columns));
    });
  } else if (props.columns !== undefined) {
    problems.push({ path: "/columns", message: "the columns are no list" });
  }
  problems.push(...treePertProblems(props, columns));
  if (!Array.isArray(props.nodes)) {
    return [...problems, { path: "/nodes", message: "the Tree holds no list of nodes" }];
  }
  const walk = { origin, columns, seen: new Set, problems, count: 0 };
  walkNodes(walk, props.nodes, 1, ["nodes"]);
  if (walk.count > TREE_MAX_NODES) {
    const message = `the Tree holds ${walk.count} nodes, over the limit of ${TREE_MAX_NODES} nodes`;
    problems.push({ path: "/nodes", message });
  }
  return problems;
};
// packages/contract/src/widgets/tree/tree-changes.json
var tree_changes_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:tree-changes",
  title: "Tree changes",
  description: "A Tree's changes (AD-20, design decision 2): the output format's changes, defined once by the answer event. The Tree's own rules on them (add, remove and move target item.node, set targets item.node.field; an add holds a name and declared fields; a set's field is label or a declared one, with a value of its type) are checked by treeChangesProblems. Empty when nothing changed. In no schema set until the input format reaches 1.1.",
  type: "array",
  items: {
    $ref: "urn:askboard:output:answer-event#/$defs/change"
  }
};
// packages/contract/src/widgets/tree/tree-props.json
var tree_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:tree-props",
  title: "Tree props",
  description: "A Tree item's props (FR-11, design decision 2): its columns and its nodes. A node holds its ID, its name, its children and a value for any field a column declares: a string for a text column, a number for a number column, absent when empty. What a schema cannot say (IDs unique across levels, the view's prefix, each field declared by a column and of its type, column fields unique, the node count and depth limits) is checked by treePropsProblems, with the rules of pert and openDepth. In no schema set until the input format reaches 1.1.",
  type: "object",
  properties: {
    columns: {
      type: "array",
      maxItems: 8,
      items: {
        $ref: "#/$defs/column"
      }
    },
    nodes: {
      type: "array",
      items: {
        $ref: "#/$defs/node"
      }
    },
    pert: {
      description: "A work breakdown (AD-13): the columns declare optimistic, mostLikely and pessimistic as numbers, every estimate is 0 to 100,000 working days, and every node and the item get the derived fields expected and spread.",
      const: true
    },
    openDepth: {
      description: "With pert only, the levels open when the board first shows the work breakdown; a Tree without pert opens fully expanded.",
      type: "integer",
      minimum: 1,
      maximum: 8
    }
  },
  required: ["nodes"],
  additionalProperties: false,
  $defs: {
    column: {
      description: "A field every node may hold, addressed as item.node.field (AD-13): never id, label or children, never a spreadsheet cell.",
      type: "object",
      properties: {
        field: {
          type: "string",
          pattern: "^(?!(?:id|label|children)$)[a-z][A-Za-z0-9]{0,63}$"
        },
        label: {
          type: "string",
          minLength: 1,
          maxLength: 200
        },
        type: {
          enum: ["text", "number"]
        }
      },
      required: ["field", "label", "type"],
      additionalProperties: false
    },
    node: {
      description: "A node: its ID (unique in the item, at every level), its name, its children if it has any, and its fields.",
      type: "object",
      properties: {
        id: {
          $ref: "urn:askboard:input:id"
        },
        label: {
          type: "string",
          minLength: 1,
          maxLength: 200
        },
        children: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/$defs/node"
          }
        }
      },
      patternProperties: {
        "^(?!(?:id|label|children)$)[a-z][A-Za-z0-9]{0,63}$": {
          $ref: "#/$defs/value"
        }
      },
      required: ["id", "label"],
      additionalProperties: false
    },
    value: {
      description: "A field's value: text of 1 to 1,000 characters or a number, by its column's type.",
      anyOf: [
        {
          type: "string",
          minLength: 1,
          maxLength: 1000
        },
        {
          type: "number"
        }
      ]
    }
  }
};

// packages/contract/src/widgets/tree/wording.ts
var TREE_EXPECTED = {
  "tree.props": "a Tree's props {columns?, nodes, pert?, openDepth?}",
  "tree.props.columns": `a list of at most ${TREE_MAX_COLUMNS} columns, each {field, label, type}`,
  "tree.props.columns[]": "a column {field, label, type}",
  "tree.props.columns[].field": `a field name matching ${TREE_FIELD_PATTERN}, never id, label or children, unique among the columns`,
  "tree.props.columns[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.columns[].type": '"text" or "number"',
  "tree.props.nodes": `a list of nodes, at most ${TREE_MAX_NODES} in all and ${TREE_MAX_DEPTH} levels deep`,
  "tree.props.nodes[]": "a node {id, label, children?} with a value for each column field it has",
  "tree.props.nodes[].id": `${ID_SHAPE}, unique among the Tree's nodes at every level`,
  "tree.props.nodes[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.nodes[].children": "a non-empty list of nodes",
  "tree.props.nodes[].{field}": `a value for a field a column declares: text of 1 to ${TREE_TEXT_MAX_CHARS} characters for a text column, a number for a number column`,
  "tree.props.pert": "true, on a Tree whose columns declare optimistic, mostLikely and pessimistic as numbers",
  "tree.props.openDepth": `a whole number of 1 to ${TREE_MAX_DEPTH}, with pert only`
};
var TREE_FIELDS = {
  "tree.props": "a Tree's props hold only columns, nodes, pert and openDepth",
  "tree.props.columns[]": "a column holds only field, label and type",
  "tree.props.nodes[]": "a node holds only id, label, children and the fields its columns declare"
};
var NODE_KEYS2 = ["id", "label", "children"];
const treeRest = (rest) => {
  if (rest[1] !== "nodes" || !isIndex(rest[2]))
    return rest;
  const head = rest.slice(0, 3);
  let tail = rest.slice(3);
  while (tail[0] === "children" && isIndex(tail[1]))
    tail = tail.slice(2);
  const [field] = tail;
  return field !== undefined && !NODE_KEYS2.includes(field) && !isIndex(field) ? [...head, "{field}"] : [...head, ...tail];
};
const treeElementOf = (item, rest) => {
  if (!isRecord(item) || rest[1] !== "nodes")
    return;
  let list = isRecord(item.props) ? item.props.nodes : undefined;
  let found;
  let at = 2;
  while (Array.isArray(list) && isIndex(rest[at])) {
    const node = list[Number(rest[at])];
    if (!isRecord(node))
      break;
    if (typeof node.id === "string")
      found = node.id;
    if (rest[at + 1] !== "children" || !isIndex(rest[at + 2]))
      break;
    list = node.children;
    at += 2;
  }
  return found === undefined ? undefined : `node "${found}"`;
};

// packages/contract/src/widgets/tree/widget.ts
const hasNode = (props, nodeId) => {
  const walk = (nodes) => Array.isArray(nodes) && nodes.some((node) => isRecord(node) && (node.id === nodeId || walk(node.children)));
  return isRecord(props) && walk(props.nodes);
};
const derivedProblem2 = (rest, props) => {
  const fields = TREE_PERT_ANSWER_DERIVED.fields;
  if (!(isRecord(props) && props.pert === true)) {
    return "a Tree declares derived values only with pert";
  }
  const [first, second] = rest;
  const totals = rest.length === 1 && fields.includes(first ?? "");
  const node = rest.length === 2 && fields.includes(second ?? "") && hasNode(props, first ?? "");
  return totals || node ? undefined : `a Tree with pert declares ${fields.join(" and ")} and its nodes'`;
};
var TREE_WIDGET = {
  type: "tree",
  noun: "a Tree",
  props: tree_props_default,
  propsProblems: treePropsProblems,
  edits: { changes: tree_changes_default, shape: () => TREE_SHAPE },
  derived: {
    describe: `the item totals and each node's ${TREE_PERT_ANSWER_DERIVED.fields.join(" and ")}, with pert`,
    problem: derivedProblem2
  },
  wording: {
    expected: TREE_EXPECTED,
    fields: TREE_FIELDS,
    rest: treeRest,
    element: treeElementOf
  },
  example: {
    item: {
      type: "tree",
      id: "wbs",
      props: { nodes: [{ id: "design", label: "Design", children: [{ id: "ux", label: "UX" }] }] }
    }
  },
  keys: TREE_KEYS,
  help: {
    mouse: "Click a name to edit it, drag a row to move it (Escape cancels a drag), tick the check box beside a row to select it, and use the toolbar to add, move, indent, outdent or delete nodes.",
    answer: "The agent receives the changes you made to the hierarchy: nodes added, renamed, moved or removed, and any estimates you changed."
  },
  skill: {
    use: "a work breakdown or any hierarchy the user edits: add, move, rename, remove nodes, adjust estimates"
  }
};

// packages/contract/src/widgets/value/constants.ts
var VALUE_MAX_DAYS = 1e5;
var VALUE_KINDS = /* @__PURE__ */ Object.freeze([
  "number",
  "percent",
  "money",
  "date",
  "duration"
]);
var VALUE_FIELDS = /* @__PURE__ */ Object.freeze([
  "value",
  "unit",
  "amount",
  "currency",
  "date",
  "days"
]);
var VALUE_KIND_FIELDS = /* @__PURE__ */ Object.freeze({
  number: Object.freeze(["value", "unit"]),
  percent: Object.freeze(["value"]),
  money: Object.freeze(["amount", "currency"]),
  date: Object.freeze(["date"]),
  duration: Object.freeze(["days"])
});
var VALUE_REQUIRED_FIELDS = /* @__PURE__ */ Object.freeze({
  number: Object.freeze(["value"]),
  percent: Object.freeze(["value"]),
  money: Object.freeze(["amount", "currency"]),
  date: Object.freeze(["date"]),
  duration: Object.freeze(["days"])
});

// packages/contract/src/widgets/value/checks.ts
var CURRENCY2 = /^[A-Z]{3}$/;
const isKind = (kind) => typeof kind === "string" && VALUE_KINDS.includes(kind);
const boundedNumber2 = (value) => typeof value === "number" && Number.isFinite(value) && value >= -ATOM_NUMBER_BOUND && value <= ATOM_NUMBER_BOUND;
const fieldProblem = (field, value) => {
  switch (field) {
    case "label":
      return typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= ATOM_LABEL_MAX_CHARS ? undefined : `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`;
    case "value":
      return boundedNumber2(value) ? undefined : `the value is a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`;
    case "unit":
      return typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= ATOM_UNIT_MAX_CHARS ? undefined : `the unit is a text of 1 to ${ATOM_UNIT_MAX_CHARS} characters`;
    case "amount":
      return typeof value === "string" && AMOUNT_PATTERN.test(value) ? undefined : "the amount is a decimal string of at most 15 integer digits and 4 decimals, as in 12480.50, and no finer than its currency takes";
    case "currency":
      return typeof value === "string" && CURRENCY2.test(value) ? undefined : "the currency is an ISO 4217 code of three capital letters";
    case "date":
      return isGanttDate(value) ? undefined : `the date is a day that exists, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
    default:
      return Number.isInteger(value) && value >= 0 && value <= VALUE_MAX_DAYS ? undefined : `the days are a whole number from 0 to ${VALUE_MAX_DAYS}`;
  }
};
const valuePropsProblems = (props) => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Value's props are an object {label?, kind, ...}" }];
  }
  const { kind } = props;
  if (!isKind(kind)) {
    return [{ path: "/kind", message: `the kind is one of ${VALUE_KINDS.join(", ")}` }];
  }
  const held = VALUE_KIND_FIELDS[kind];
  const problems = [];
  for (const key of Object.keys(props)) {
    if (key === "kind" || key === "label")
      continue;
    const known = VALUE_FIELDS.includes(key);
    if (!known)
      problems.push({ path: `/${key}`, message: `unknown field "${key}"` });
    else if (!held.includes(key)) {
      problems.push({ path: `/${key}`, message: `a ${kind} Value holds no "${key}"` });
    }
  }
  for (const field of VALUE_REQUIRED_FIELDS[kind]) {
    if (props[field] === undefined) {
      problems.push({ path: `/${field}`, message: `a ${kind} Value requires "${field}"` });
    }
  }
  for (const field of ["label", ...held]) {
    if (props[field] === undefined)
      continue;
    const problem = fieldProblem(field, props[field]);
    if (problem !== undefined)
      problems.push({ path: `/${field}`, message: problem });
  }
  const { amount, currency } = props;
  if (kind === "money" && problems.length === 0 && typeof amount === "string" && typeof currency === "string") {
    const finer = minorUnitsProblem(amount, currency);
    if (finer !== undefined)
      problems.push({ path: "/amount", message: finer });
  }
  return problems;
};
// packages/contract/src/widgets/value/value-props.json
var value_props_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:value-props",
  title: "Value props",
  description: "A Value item's props (FR-13, atoms design decision 1): an optional label and a kind with its value. number holds value within a quadrillion either way and an optional unit; percent holds value, a ratio (0.185 is 18.5%); money holds amount, a decimal string, and currency, an ISO 4217 code; date holds date, a full-date; duration holds days, whole days. A field of another kind is refused. That a date exists within the Gantt's days is a check of valuePropsProblems. It gives no result. In the input format since atoms.",
  type: "object",
  properties: {
    label: {
      type: "string",
      minLength: 1,
      maxLength: 200
    },
    kind: {
      enum: ["number", "percent", "money", "date", "duration"]
    },
    value: {
      type: "number",
      minimum: -1000000000000000,
      maximum: 1000000000000000
    },
    unit: {
      type: "string",
      minLength: 1,
      maxLength: 20
    },
    amount: {
      type: "string",
      pattern: "^-?(0|[1-9][0-9]{0,14})(\\.[0-9]{1,4})?$"
    },
    currency: {
      type: "string",
      pattern: "^[A-Z]{3}$"
    },
    date: {
      $ref: "urn:askboard:input:gantt-props#/$defs/fullDate"
    },
    days: {
      type: "integer",
      minimum: 0,
      maximum: 1e5
    }
  },
  required: ["kind"],
  if: {
    properties: {
      kind: {
        const: "number"
      }
    },
    required: ["kind"]
  },
  then: {
    required: ["value"],
    properties: {
      value: true,
      amount: false,
      currency: false,
      date: false,
      days: false
    }
  },
  else: {
    if: {
      properties: {
        kind: {
          const: "percent"
        }
      },
      required: ["kind"]
    },
    then: {
      required: ["value"],
      properties: {
        value: true,
        unit: false,
        amount: false,
        currency: false,
        date: false,
        days: false
      }
    },
    else: {
      if: {
        properties: {
          kind: {
            const: "money"
          }
        },
        required: ["kind"]
      },
      then: {
        required: ["amount", "currency"],
        properties: {
          amount: true,
          currency: true,
          value: false,
          unit: false,
          date: false,
          days: false
        }
      },
      else: {
        if: {
          properties: {
            kind: {
              const: "date"
            }
          },
          required: ["kind"]
        },
        then: {
          required: ["date"],
          properties: {
            date: true,
            value: false,
            unit: false,
            amount: false,
            currency: false,
            days: false
          }
        },
        else: {
          required: ["days"],
          properties: {
            days: true,
            value: false,
            unit: false,
            amount: false,
            currency: false,
            date: false
          }
        }
      }
    }
  },
  additionalProperties: false
};

// packages/contract/src/widgets/value/wording.ts
var VALUE_EXPECTED = {
  "value.props": "a Value's props {label?, kind, and the kind's fields: value and unit? for number, value for percent, amount and currency for money, date, days}",
  "value.props.label": text(ATOM_LABEL_MAX_CHARS),
  "value.props.kind": '"number", "percent", "money", "date" or "duration"',
  "value.props.value": `a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}, for a number or a percent (a ratio: 0.185 is 18.5%)`,
  "value.props.unit": `${text(ATOM_UNIT_MAX_CHARS)}, for a number only`,
  "value.props.amount": "a decimal string of at most 15 integer digits, as in 12480.50, with no more decimals than its currency takes (0 for JPY, 2 for EUR), for money",
  "value.props.currency": "an ISO 4217 code of three capital letters, as in EUR, for money",
  "value.props.date": `a full-date from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}, for a date`,
  "value.props.days": `a whole number of days from 0 to ${VALUE_MAX_DAYS}, for a duration`
};
var VALUE_FIELDS_WORDING = {
  "value.props": "a Value's props hold only label, kind, and the kind's fields: value, unit, amount, currency, date and days"
};

// packages/contract/src/widgets/value/widget.ts
var VALUE_WIDGET = {
  type: "value",
  noun: "a Value",
  props: value_props_default,
  propsProblems: valuePropsProblems,
  wording: { expected: VALUE_EXPECTED, fields: VALUE_FIELDS_WORDING },
  example: {
    item: {
      type: "value",
      id: "forecast",
      props: { label: "Budget", kind: "money", amount: "12480.50", currency: "EUR" }
    }
  },
  help: {
    mouse: "Read it: it shows a number, percentage, amount, date or duration as the agent gave it.",
    answer: "Nothing: a figure is for reading and gives no answer."
  },
  skill: {
    use: "a figure the user reads: a number, percentage, amount, date or duration",
    notes: [
      "`kind` is `number` or `percent` with `value` (a percentage is a ratio: 0.185 shows 18.5%), `money` with `amount` and `currency`, `date` with `date`, or `duration` with `days`. It gives no answer."
    ]
  }
};

// packages/contract/src/widgets/registry.ts
var WIDGET_TYPES = [
  TREE_WIDGET,
  GANTT_WIDGET,
  APPROVAL_WIDGET,
  SCALE_WIDGET,
  RANKING_WIDGET,
  LATEX_WIDGET,
  KANBAN_WIDGET,
  TIMELINE_WIDGET,
  CHART_WIDGET,
  TEXT_WIDGET,
  VALUE_WIDGET,
  DIVIDER_WIDGET,
  TEXT_FIELD_WIDGET,
  NUMBER_FIELD_WIDGET,
  MONEY_FIELD_WIDGET,
  DATE_FIELD_WIDGET,
  TOGGLE_WIDGET,
  STACK_WIDGET,
  ROW_WIDGET,
  GROUP_WIDGET,
  TABS_WIDGET,
  PICK_FIELD_WIDGET,
  TABLE_WIDGET,
  DOCUMENT_REVIEW_WIDGET
];
var CONTEXT_ONLY_ITEM_TYPES = ["excerpt", "reference", "image"];
var NON_WIDGET_ITEM_TYPES = [
  ...CONTEXT_ONLY_ITEM_TYPES,
  "molecule",
  "question",
  "area"
];
var ID4 = new RegExp(ID_PATTERN);
var BASE_DEFINITIONS = new Set([
  ...[question_props_default, board_document_default, fetch_result_default].flatMap((base) => Object.keys(base.$defs)),
  LAYOUT_ITEM_DEFINITION
]);
// packages/contract/src/schemas/output/annotation.json
var annotation_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:annotation",
  title: "Annotation",
  description: "A note a user attached to a place in the content of a widget item (widget-registry, design decision 7): an ID, a target, the selector that finds the place, and a body: a comment, a suggested edit or both. A widget's result schema references it for the annotations the widget gives, as the answer's results hold them. The selector is picked by its type: element (an element's ID), label (a label and which occurrence), region (xywh=percent:x,y,w,h), line (a side of a diff, a path and a line), quote (the exact text with optional context) or position (a start and an end). annotationProblems adds what a schema cannot say: a start after the end, a region outside 100 by 100. A later selector is a minor.",
  type: "object",
  properties: {
    id: {
      $ref: "urn:askboard:input:id"
    },
    target: {
      type: "object",
      properties: {
        selector: {
          $ref: "#/$defs/selector"
        }
      },
      required: ["selector"],
      additionalProperties: false
    },
    body: {
      description: "A comment (text), a suggested edit that replaces the target's text (replacement; an empty one deletes it), or both; since document-review. A widget's result schema may take fewer of them.",
      type: "object",
      properties: {
        text: {
          type: "string",
          minLength: 1,
          maxLength: 2000
        },
        replacement: {
          type: "string",
          maxLength: 4000
        }
      },
      minProperties: 1,
      additionalProperties: false
    }
  },
  required: ["id", "target", "body"],
  additionalProperties: false,
  $defs: {
    selector: {
      description: "A selector, picked by its type.",
      type: "object",
      discriminator: {
        propertyName: "type"
      },
      oneOf: [
        {
          $ref: "#/$defs/element"
        },
        {
          $ref: "#/$defs/label"
        },
        {
          $ref: "#/$defs/region"
        },
        {
          $ref: "#/$defs/line"
        },
        {
          $ref: "#/$defs/quote"
        },
        {
          $ref: "#/$defs/position"
        }
      ]
    },
    element: {
      type: "object",
      properties: {
        type: {
          const: "element"
        },
        id: {
          $ref: "urn:askboard:input:id"
        }
      },
      required: ["type", "id"],
      additionalProperties: false
    },
    label: {
      type: "object",
      properties: {
        type: {
          const: "label"
        },
        label: {
          type: "string",
          minLength: 1,
          maxLength: 200
        },
        occurrence: {
          description: "Which element with this label, counting from 1; the first when left out.",
          type: "integer",
          minimum: 1
        }
      },
      required: ["type", "label"],
      additionalProperties: false
    },
    region: {
      type: "object",
      properties: {
        type: {
          const: "region"
        },
        value: {
          description: "xywh=percent:x,y,w,h, each a number of percent of the item's width or height; annotationProblems checks that the region lies inside 100 by 100.",
          type: "string",
          maxLength: 100,
          pattern: "^xywh=percent:[0-9]+(\\.[0-9]+)?,[0-9]+(\\.[0-9]+)?,[0-9]+(\\.[0-9]+)?,[0-9]+(\\.[0-9]+)?$"
        }
      },
      required: ["type", "value"],
      additionalProperties: false
    },
    line: {
      type: "object",
      properties: {
        type: {
          const: "line"
        },
        side: {
          enum: ["old", "new"]
        },
        path: {
          description: "The path of the file, as a pointer's path.",
          type: "string",
          minLength: 1,
          maxLength: 1024
        },
        line: {
          type: "integer",
          minimum: 1
        }
      },
      required: ["type", "side", "path", "line"],
      additionalProperties: false
    },
    quote: {
      type: "object",
      properties: {
        type: {
          const: "quote"
        },
        exact: {
          type: "string",
          minLength: 1,
          maxLength: 2000
        },
        prefix: {
          type: "string",
          maxLength: 200
        },
        suffix: {
          type: "string",
          maxLength: 200
        }
      },
      required: ["type", "exact"],
      additionalProperties: false
    },
    position: {
      type: "object",
      properties: {
        type: {
          const: "position"
        },
        start: {
          type: "integer",
          minimum: 0
        },
        end: {
          type: "integer",
          minimum: 0
        }
      },
      required: ["type", "start", "end"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/schemas/output/answer-event.json
var answer_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:answer-event",
  title: "Answer event",
  description: `An answer the user gave on the board (AD-10), naming its item and the question's revision, who answered and when the user acted (FR-18, FR-19). Its content fields are those of finding F4 and FR-3, each optional: choice (the chosen options, by label), other (the "Other…" text), optionNotes (the user's note on an option, by label), note (the open-prompt text, or a decline's reason), changes (AD-20's generic diff of agent content the user edited), results (per item ID, what a widget produces that is not an edit) and derived (derived values, by reference). results and derived stay open until each widget's epic narrows them (F7). A decline (declined) closes the question like an answer and carries at most its reason as note; replaces names the cursor of the answer a revision replaces (AD-20). Since 1.3, tooLarge marks an event whose changes and derived exceeded the largest event a result holds: it carries neither, and fetch returns them; since widget-registry it carries no results either, whatever the item (AD-20). A Choice answer carries only choice.`,
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "answer"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    },
    who: {
      type: "string",
      minLength: 1,
      maxLength: 256
    },
    when: {
      $ref: "urn:askboard:output:time"
    },
    choice: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1
      }
    },
    other: {
      type: "string",
      minLength: 1,
      maxLength: 1e4
    },
    optionNotes: {
      type: "object",
      minProperties: 1,
      propertyNames: {
        type: "string",
        minLength: 1
      },
      additionalProperties: {
        type: "string",
        minLength: 1,
        maxLength: 2000
      }
    },
    note: {
      type: "string",
      minLength: 1,
      maxLength: 1e4
    },
    changes: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "#/$defs/change"
      }
    },
    results: {
      type: "object",
      propertyNames: {
        $ref: "urn:askboard:input:id"
      }
    },
    derived: {
      type: "object",
      propertyNames: {
        $ref: "#/$defs/reference"
      }
    },
    declined: {
      const: true
    },
    replaces: {
      $ref: "urn:askboard:output:cursor"
    },
    tooLarge: {
      description: "Since 1.3: the event's changes and derived, which exceeded ANSWER_EVENT_MAX_CHARS, are not here; since widget-registry its results are not either; fetch returns them (FR-20, AD-20).",
      const: true
    }
  },
  required: ["cursor", "type", "itemId", "rev", "who", "when"],
  additionalProperties: false,
  dependentSchemas: {
    tooLarge: {
      properties: {
        changes: false,
        results: false,
        derived: false
      }
    }
  },
  if: {
    properties: {
      declined: {
        const: true
      }
    },
    required: ["declined"]
  },
  then: {
    properties: {
      choice: false,
      other: false,
      optionNotes: false,
      changes: false,
      results: false,
      derived: false
    }
  },
  $defs: {
    reference: {
      description: "AD-13's reference syntax without brackets: the item ID, then child IDs or a field, separated by dots; never an array index.",
      type: "string",
      pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$"
    },
    change: {
      description: "One operation of AD-20's generic diff, addressing elements by ID: add and move name the parent and the preceding sibling, each omitted when there is none (the top level, the first position).",
      oneOf: [
        {
          $ref: "#/$defs/add"
        },
        {
          $ref: "#/$defs/remove"
        },
        {
          $ref: "#/$defs/move"
        },
        {
          $ref: "#/$defs/set"
        }
      ]
    },
    add: {
      type: "object",
      properties: {
        op: {
          const: "add"
        },
        target: {
          $ref: "#/$defs/reference"
        },
        parent: {
          $ref: "urn:askboard:input:id"
        },
        after: {
          $ref: "urn:askboard:input:id"
        },
        value: {}
      },
      required: ["op", "target", "value"],
      additionalProperties: false
    },
    remove: {
      type: "object",
      properties: {
        op: {
          const: "remove"
        },
        target: {
          $ref: "#/$defs/reference"
        }
      },
      required: ["op", "target"],
      additionalProperties: false
    },
    move: {
      type: "object",
      properties: {
        op: {
          const: "move"
        },
        target: {
          $ref: "#/$defs/reference"
        },
        parent: {
          $ref: "urn:askboard:input:id"
        },
        after: {
          $ref: "urn:askboard:input:id"
        }
      },
      required: ["op", "target"],
      additionalProperties: false
    },
    set: {
      type: "object",
      properties: {
        op: {
          const: "set"
        },
        target: {
          $ref: "#/$defs/reference"
        },
        value: {}
      },
      required: ["op", "target", "value"],
      additionalProperties: false
    }
  }
};
// packages/contract/src/schemas/output/ask-state.json
var ask_state_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:ask-state",
  title: "Ask state",
  description: "The ask states (AD-10): waiting until the first answer, decline or postpone; answered while every question that is not postponed is answered or declined; partly-answered otherwise; closed by the agent; discarded at session exit, when its board is gone past the grace period, or when its cursor is of another epoch.",
  enum: ["waiting", "partly-answered", "answered", "closed", "discarded"]
};
// packages/contract/src/schemas/output/closed-event.json
var closed_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:closed-event",
  title: "Closed event",
  description: "The final event of an ask AskBoard closed, not the agent: its owner, a subagent, finished (AD-3, AD-10), and the ask takes no more answers. An agent's own close is reported in its call's result and is not an event.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "closed"
    },
    reason: {
      enum: ["agent-finished"]
    }
  },
  required: ["cursor", "type", "reason"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/cursor.json
var cursor_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:cursor",
  title: "Cursor",
  description: "Exactly <epoch>.<seq> for one ask (AD-3). Agents never build one: they pass the latest they received.",
  type: "string",
  pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$"
};
// packages/contract/src/schemas/output/discarded-event.json
var discarded_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:discarded-event",
  title: "Discarded event",
  description: "The final event of a discarded ask (AD-21): its unsent answers will not come. An ask is discarded at session exit, or when its board is gone and none reconnects within the grace period (board-closed).",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "discarded"
    },
    reason: {
      enum: ["session-exit", "board-closed"]
    }
  },
  required: ["cursor", "type", "reason"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/edit-choice-event.json
var edit_choice_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:edit-choice-event",
  title: "Edit choice event",
  description: "What the user chose when the agent changed a question they had unsent work on (FR-6, AD-20), at the question's current revision: reload, dropping the work, or ignore, keeping it, with keptRev naming the earlier revision an answer may then name.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "edit-choice"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    },
    edit: {
      enum: ["reload", "ignore"]
    },
    keptRev: {
      type: "integer",
      minimum: 1
    }
  },
  required: ["cursor", "type", "itemId", "rev", "edit"],
  additionalProperties: false,
  if: {
    properties: {
      edit: {
        const: "ignore"
      }
    }
  },
  then: {
    properties: {
      keptRev: true
    },
    required: ["keptRev"]
  },
  else: {
    properties: {
      keptRev: false
    }
  }
};
// packages/contract/src/schemas/output/epoch.json
var epoch_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:epoch",
  title: "Epoch",
  description: "The session process's random epoch, which scopes its ask IDs and cursors (AD-2, AD-10). Every tool result carries it.",
  type: "string",
  pattern: "^[a-z0-9]{4,16}$"
};
// packages/contract/src/schemas/output/follow-up-event.json
var follow_up_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:follow-up-event",
  title: "Follow-up event",
  description: "A follow-up the user wrote on a question, whatever its state (FR-10): the agent replies with update, naming this event's cursor. It changes neither the question's revision nor its state.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "follow-up"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    },
    who: {
      type: "string",
      minLength: 1,
      maxLength: 256
    },
    when: {
      $ref: "urn:askboard:output:time"
    },
    text: {
      type: "string",
      minLength: 1,
      maxLength: 1e4
    }
  },
  required: ["cursor", "type", "itemId", "rev", "who", "when", "text"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/note-event.json
var note_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:note-event",
  title: "Note event",
  description: "A note the user sent on a question without answering it, the open prompt's text (FR-7); the question's state is unchanged.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "note"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    },
    who: {
      type: "string",
      minLength: 1,
      maxLength: 256
    },
    when: {
      $ref: "urn:askboard:output:time"
    },
    note: {
      type: "string",
      minLength: 1,
      maxLength: 1e4
    }
  },
  required: ["cursor", "type", "itemId", "rev", "who", "when", "note"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/outcome.json
var outcome_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:outcome",
  title: "Outcome",
  description: "The typed results that are not errors (AD-6): unavailable when no board can be shown (AD-18); open when a waiting collect ends after its longest wait with nothing for its item (AD-4), postponed when the item it waits for is postponed, closed when the ask is closed; closed and discarded when update or fetch meets an ask that is (AD-10, AD-21).",
  enum: ["unavailable", "open", "postponed", "closed", "discarded"]
};
// packages/contract/src/schemas/output/postponed-event.json
var postponed_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:postponed-event",
  title: "Postponed event",
  description: "The user postponed a question at its revision (FR-4): it stays open for later, and an ask whose other questions are answered or declined is answered.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "postponed"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    }
  },
  required: ["cursor", "type", "itemId", "rev"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/question-state.json
var question_state_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:question-state",
  title: "Question state",
  description: "A question's state (AD-10): answered or declined while its latest answer, logged or recorded, says so; postponed while a logged postpone of it is not undone; open otherwise.",
  enum: ["open", "answered", "postponed", "declined"]
};
// packages/contract/src/schemas/output/reopened-event.json
var reopened_event_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:reopened-event",
  title: "Reopened event",
  description: "The user undid a sent postpone or decline (FR-4, AD-20): the question is open again at its revision.",
  type: "object",
  properties: {
    cursor: {
      $ref: "urn:askboard:output:cursor"
    },
    type: {
      const: "reopened"
    },
    itemId: {
      $ref: "urn:askboard:input:id"
    },
    rev: {
      type: "integer",
      minimum: 1
    }
  },
  required: ["cursor", "type", "itemId", "rev"],
  additionalProperties: false
};
// packages/contract/src/schemas/output/time.json
var time_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:time",
  title: "UTC time",
  description: "RFC 3339 in UTC, T and Z in capitals, each field within its range, with an optional fraction of a second (Consistency Conventions, Time and identity).",
  type: "string",
  pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$"
};
// packages/contract/src/schemas/output/unavailable-reason.json
var unavailable_reason_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:unavailable-reason",
  title: "Unavailable reason",
  description: "Why no board can be shown, in the order of AD-18's detection rule: a remote host, a container, a CI runner without BROWSER, or no browser opener.",
  enum: ["remote-host", "container", "ci", "no-browser"]
};
// packages/contract/src/schemas/output/warning.json
var warning_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:warning",
  title: "Warning",
  description: "A typed warning in a successful result (AD-6). E1's one warning, no-hooks, says that the session runs without hooks, so push, ownership checks and the stop guard are unavailable and the agent must collect before it finishes (AD-5). Since 1.2, unresolved-pointer names a context item whose pointer did not resolve, with the pointer and the reason; it never refuses the ask (excerpts, design decision 4; FR-8). Since 1.3, formula names an item whose formulas the send-time graph check found in error: the item's ID in reference addressing, the address of the node in error, the formula error kind and a message; it never refuses the ask either (AD-13, FR-14).",
  type: "object",
  properties: {
    code: {
      enum: ["no-hooks", "unresolved-pointer", "formula"]
    },
    message: {
      type: "string",
      minLength: 1
    },
    itemId: { $ref: "urn:askboard:input:id" },
    pointer: { $ref: "urn:askboard:input:pointer" },
    address: { type: "string", minLength: 1, maxLength: 256 },
    error: {
      enum: [
        "syntax",
        "over-limit",
        "not-whitelisted",
        "missing-reference",
        "cycle",
        "mixed-currencies",
        "value",
        "division-by-zero"
      ]
    },
    reason: {
      enum: [
        "no-root",
        "invalid-pointer",
        "outside-root",
        "not-found",
        "not-a-file",
        "anchor-not-found",
        "not-text",
        "not-image",
        "too-large",
        "timeout"
      ]
    }
  },
  required: ["code", "message"],
  additionalProperties: false,
  if: { properties: { code: { const: "unresolved-pointer" } } },
  then: {
    properties: {
      itemId: true,
      pointer: true,
      reason: true,
      address: false,
      error: false
    },
    required: ["itemId", "pointer", "reason"]
  },
  else: {
    if: { properties: { code: { const: "formula" } } },
    then: {
      properties: {
        itemId: true,
        address: true,
        error: true,
        pointer: false,
        reason: false
      },
      required: ["itemId", "address", "error"]
    },
    else: {
      properties: {
        itemId: false,
        pointer: false,
        reason: false,
        address: false,
        error: false
      }
    }
  }
};

// packages/contract/src/schemas/output/index.ts
var OUTPUT_FORMAT_VERSION = "1.12";
var outputFormat = {
  name: "output",
  title: "output format",
  owner: "contract",
  version: OUTPUT_FORMAT_VERSION,
  schemas: [
    epoch_default,
    cursor_default,
    time_default,
    ask_state_default,
    answer_event_default,
    discarded_event_default,
    warning_default,
    outcome_default,
    unavailable_reason_default,
    question_state_default,
    postponed_event_default,
    reopened_event_default,
    note_event_default,
    follow_up_event_default,
    edit_choice_event_default,
    closed_event_default,
    annotation_default,
    ...WIDGET_TYPES.flatMap(({ edits, result }) => [
      ...edits === undefined ? [] : [edits.changes],
      ...result === undefined ? [] : [result.schema]
    ])
  ]
};
// packages/contract/src/push/local-api/index.ts
var LOCAL_API_VERSION = "1.0";
const schemaId = (name) => `urn:askboard:local-api:${name}`;
var LOCAL_API_MESSAGES = {
  recordsRequest: schemaId("records-request"),
  recordsResponse: schemaId("ack"),
  stopRequest: schemaId("stop-request"),
  stopResponse: schemaId("stop-response"),
  ruleResponse: schemaId("rule-response"),
  noticeResponse: schemaId("notice-response"),
  modHelloRequest: schemaId("mod-hello-request"),
  modHelloResponse: schemaId("ack"),
  modTurnRequest: schemaId("mod-turn-request"),
  modTurnResponse: schemaId("ack"),
  pollResponse: schemaId("poll-response"),
  deliveredRequest: schemaId("delivered-request"),
  deliveredResponse: schemaId("ack")
};
// packages/contract/src/push/messages.ts
var PUSH_MESSAGE_PREFACE = "AskBoard: the user acted on your ask. Skip any event whose seq you have seen.";
const pushMessageText = (message) => `${PUSH_MESSAGE_PREFACE}
${JSON.stringify(message)}`;
// packages/contract/src/push/session-folder.ts
const absolute = (directory) => directory?.startsWith("/") ? directory.replace(/\/+$/, "") : undefined;
const integerAtLeast = (value, what, least) => {
  if (!Number.isSafeInteger(value) || value < least) {
    throw new RangeError(`${what} must be an integer of at least ${least}, not ${value}`);
  }
  return value;
};
const sessionFolder = ({ env, uid }) => {
  const user = integerAtLeast(uid, "a uid", 0);
  const runtime = absolute(env.XDG_RUNTIME_DIR);
  if (runtime !== undefined)
    return `${runtime}/askboard`;
  return `${absolute(env.TMPDIR) ?? "/tmp"}/askboard-${user}`;
};
const sessionFilePath = (folder, key) => `${folder}/${integerAtLeast(key, "a session key", 1)}.json`;
const socketPathFor = (folder, key) => `${folder}/${integerAtLeast(key, "a session key", 1)}.sock`;
// packages/mod/src/pending.ts
var SEPARATOR = " · ";
var HEAD = "AskBoard";
var MARK = "\uD83D\uDE4B";
var BAND_SURFACES = new Set(["terminal", "desktop"]);
const points = (text) => Array.from(text).length;
var ROW_PREFIX = `${MARK} ${HEAD} › `;
var ROW_PREFIX_COLUMNS = points(ROW_PREFIX) + 1;
const headerOf = (count) => `${MARK} ${HEAD}${SEPARATOR}${count} pending`;
const statusOf = (pending) => {
  const [first] = pending;
  if (first === undefined)
    return;
  const line = `${ROW_PREFIX}${agentTextPiece(first.title)}`;
  const more = pending.length - 1;
  return more === 0 ? line : `${line}${SEPARATOR}+${more} more`;
};
const toastLine = (ask) => {
  const room = NOTICE_TEXT_MAX_CHARS - points(`${HEAD}${SEPARATOR}`);
  return `${HEAD}${SEPARATOR}${agentTextPiece(ask.title, room)}${SEPARATOR}${ask.link}`;
};
const setStatus = (memory, $, text) => {
  if (text === memory.status)
    return;
  memory.status = text;
  $.ui.status(text);
};
const keepPending = (memory, $, pending) => {
  if (JSON.stringify(pending) === JSON.stringify(memory.pending))
    return;
  memory.pending = pending;
  $.ui.invalidate("ui.render");
};
const showPending = async (memory, $, pending) => {
  keepPending(memory, $, pending);
  const surfaces = await $.session.surfaces();
  const bandless = surfaces.some((surface) => !BAND_SURFACES.has(surface));
  setStatus(memory, $, bandless ? statusOf(pending) : undefined);
  for (const ask of pending) {
    if (ask.agent_id === undefined || memory.toasted.has(ask.askId))
      continue;
    memory.toasted.add(ask.askId);
    $.ui.toast(toastLine(ask));
  }
};
const clearPending = (memory, $) => {
  keepPending(memory, $, []);
  setStatus(memory, $, undefined);
};

// packages/mod/src/band.ts
var ACCENT = "cyan";
const titleIn = (title, columns) => agentTextPiece(title, Math.max(columns - ROW_PREFIX_COLUMNS, 1));
const rowOf = ({ Box, Text, Link }, ask, columns) => Box({
  flexDirection: "row",
  children: [
    Text({ color: ACCENT, children: ROW_PREFIX }),
    Link({ href: ask.link, label: titleIn(ask.title, columns) })
  ]
});
const drawBand = async (memory, $, e, next) => {
  const { pending } = memory;
  if (pending.length === 0 || e.props.hasSurvey)
    return next(e);
  const elements = $.ui.resolve(e);
  return elements.Box({
    flexDirection: "column",
    children: [
      elements.Text({ color: ACCENT, wrap: "truncate-end", children: headerOf(pending.length) }),
      ...pending.map((ask) => rowOf(elements, ask, e.props.bodyColumns)),
      await next(e)
    ]
  });
};

// packages/mod/src/memory.ts
const createMemory = () => ({
  location: undefined,
  starting: false,
  polling: false,
  polls: 0,
  session: undefined,
  checkedAtPoll: undefined,
  transport: "fetch",
  refusedFetches: undefined,
  probeAfter: 0,
  helloSaid: false,
  pushed: new Set,
  unreported: new Map,
  continuation: undefined,
  main: { running: false, steps: 0, appended: [], dropped: [] },
  subagents: new Map,
  subagentTurns: 0,
  pending: [],
  status: undefined,
  toasted: new Set,
  logged: new Set,
  turns: new Map,
  unsentTurns: new Map,
  turnReports: Promise.resolve(),
  teammates: new Map
});
const adopt = (memory, session) => {
  const known = memory.session;
  memory.session = session;
  if (known !== undefined && known.pid === session.pid && known.epoch === session.epoch)
    return;
  memory.helloSaid = false;
  memory.pushed = new Set;
  memory.unreported = new Map;
  memory.continuation = undefined;
  memory.toasted = new Set;
  memory.logged = new Set;
  memory.main = { ...memory.main, appended: [], dropped: [] };
  for (const [agentId, turn] of memory.subagents) {
    memory.subagents.set(agentId, { ...turn, appended: [] });
  }
};

// packages/mod/src/diagnostics.ts
const debug = ($, line) => {
  $.ui.log(`AskBoard: ${line}`, { to: "debug" });
};
const debugOnce = (memory, $, line) => {
  if (memory.logged.has(line))
    return;
  memory.logged.add(line);
  debug($, line);
};

// packages/mod/src/validators.ts
var sessionFile = validate20;
var pattern4 = new RegExp("^1\\.(0|[1-9][0-9]*)$", "u");
var pattern5 = new RegExp("^[a-z0-9]{4,16}$", "u");
var pattern6 = new RegExp("^/", "u");
var pattern7 = new RegExp("^[A-Za-z0-9_-]{22,}$", "u");
var pattern9 = new RegExp("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$", "u");
var func1 = require_ucs2length().default;
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.format === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "format" }, message: "must have required property '" + "format" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.key === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.pid === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "pid" }, message: "must have required property '" + "pid" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.epoch === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "epoch" }, message: "must have required property '" + "epoch" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.apiAddress === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "apiAddress" }, message: "must have required property '" + "apiAddress" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.sessionToken === undefined) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sessionToken" }, message: "must have required property '" + "sessionToken" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.startedAt === undefined) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "startedAt" }, message: "must have required property '" + "startedAt" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "format" || key0 === "key" || key0 === "pid" || key0 === "epoch" || key0 === "apiAddress" || key0 === "sessionToken" || key0 === "projectDir" || key0 === "startedAt")) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.format !== undefined) {
      let data0 = data.format;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err8 = { instancePath: instancePath + "/format", schemaPath: "#/properties/format/pattern", keyword: "pattern", params: { pattern: "^1\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "' + "^1\\.(0|[1-9][0-9]*)$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/format", schemaPath: "#/properties/format/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data1 = data.key;
      if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
        const err10 = { instancePath: instancePath + "/key", schemaPath: "#/properties/key/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err11 = { instancePath: instancePath + "/key", schemaPath: "#/properties/key/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      }
    }
    if (data.pid !== undefined) {
      let data2 = data.pid;
      if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
        const err12 = { instancePath: instancePath + "/pid", schemaPath: "#/properties/pid/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      if (typeof data2 == "number" && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err13 = { instancePath: instancePath + "/pid", schemaPath: "#/properties/pid/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
    if (data.epoch !== undefined) {
      let data3 = data.epoch;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err14 = { instancePath: instancePath + "/epoch", schemaPath: "urn:askboard:output:epoch/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}$" + '"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/epoch", schemaPath: "urn:askboard:output:epoch/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.apiAddress !== undefined) {
      let data4 = data.apiAddress;
      if (typeof data4 === "string") {
        if (func1(data4) > 107) {
          const err16 = { instancePath: instancePath + "/apiAddress", schemaPath: "#/properties/apiAddress/maxLength", keyword: "maxLength", params: { limit: 107 }, message: "must NOT have more than 107 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (!pattern6.test(data4)) {
          const err17 = { instancePath: instancePath + "/apiAddress", schemaPath: "#/properties/apiAddress/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "' + "^/" + '"' };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/apiAddress", schemaPath: "#/properties/apiAddress/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.sessionToken !== undefined) {
      let data5 = data.sessionToken;
      if (typeof data5 === "string") {
        if (func1(data5) > 256) {
          const err19 = { instancePath: instancePath + "/sessionToken", schemaPath: "#/properties/sessionToken/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern7.test(data5)) {
          const err20 = { instancePath: instancePath + "/sessionToken", schemaPath: "#/properties/sessionToken/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{22,}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{22,}$" + '"' };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/sessionToken", schemaPath: "#/properties/sessionToken/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.projectDir !== undefined) {
      let data6 = data.projectDir;
      if (typeof data6 === "string") {
        if (func1(data6) > 4096) {
          const err22 = { instancePath: instancePath + "/projectDir", schemaPath: "#/properties/projectDir/maxLength", keyword: "maxLength", params: { limit: 4096 }, message: "must NOT have more than 4096 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!pattern6.test(data6)) {
          const err23 = { instancePath: instancePath + "/projectDir", schemaPath: "#/properties/projectDir/pattern", keyword: "pattern", params: { pattern: "^/" }, message: 'must match pattern "' + "^/" + '"' };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = { instancePath: instancePath + "/projectDir", schemaPath: "#/properties/projectDir/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.startedAt !== undefined) {
      let data7 = data.startedAt;
      if (typeof data7 === "string") {
        if (!pattern9.test(data7)) {
          const err25 = { instancePath: instancePath + "/startedAt", schemaPath: "urn:askboard:output:time/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" }, message: 'must match pattern "' + "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" + '"' };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = { instancePath: instancePath + "/startedAt", schemaPath: "urn:askboard:output:time/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
  } else {
    const err27 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err27];
    } else {
      vErrors.push(err27);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var poll = validate21;
var schema40 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:askboard:output:ask-state", title: "Ask state", description: "The ask states (AD-10): waiting until the first answer, decline or postpone; answered while every question that is not postponed is answered or declined; partly-answered otherwise; closed by the agent; discarded at session exit, when its board is gone past the grace period, or when its cursor is of another epoch.", enum: ["waiting", "partly-answered", "answered", "closed", "discarded"] };
var pattern12 = new RegExp("^[A-Za-z0-9_-]{1,64}$", "u");
var pattern13 = new RegExp("^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$", "u");
var schema50 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:askboard:output:answer-event", title: "Answer event", description: `An answer the user gave on the board (AD-10), naming its item and the question's revision, who answered and when the user acted (FR-18, FR-19). Its content fields are those of finding F4 and FR-3, each optional: choice (the chosen options, by label), other (the "Other…" text), optionNotes (the user's note on an option, by label), note (the open-prompt text, or a decline's reason), changes (AD-20's generic diff of agent content the user edited), results (per item ID, what a widget produces that is not an edit) and derived (derived values, by reference). results and derived stay open until each widget's epic narrows them (F7). A decline (declined) closes the question like an answer and carries at most its reason as note; replaces names the cursor of the answer a revision replaces (AD-20). Since 1.3, tooLarge marks an event whose changes and derived exceeded the largest event a result holds: it carries neither, and fetch returns them; since widget-registry it carries no results either, whatever the item (AD-20). A Choice answer carries only choice.`, type: "object", properties: { cursor: { $ref: "urn:askboard:output:cursor" }, type: { const: "answer" }, itemId: { $ref: "urn:askboard:input:id" }, rev: { type: "integer", minimum: 1 }, who: { type: "string", minLength: 1, maxLength: 256 }, when: { $ref: "urn:askboard:output:time" }, choice: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } }, other: { type: "string", minLength: 1, maxLength: 1e4 }, optionNotes: { type: "object", minProperties: 1, propertyNames: { type: "string", minLength: 1 }, additionalProperties: { type: "string", minLength: 1, maxLength: 2000 } }, note: { type: "string", minLength: 1, maxLength: 1e4 }, changes: { type: "array", minItems: 1, items: { $ref: "#/$defs/change" } }, results: { type: "object", propertyNames: { $ref: "urn:askboard:input:id" } }, derived: { type: "object", propertyNames: { $ref: "#/$defs/reference" } }, declined: { const: true }, replaces: { $ref: "urn:askboard:output:cursor" }, tooLarge: { description: "Since 1.3: the event's changes and derived, which exceeded ANSWER_EVENT_MAX_CHARS, are not here; since widget-registry its results are not either; fetch returns them (FR-20, AD-20).", const: true } }, required: ["cursor", "type", "itemId", "rev", "who", "when"], additionalProperties: false, dependentSchemas: { tooLarge: { properties: { changes: false, results: false, derived: false } } }, if: { properties: { declined: { const: true } }, required: ["declined"] }, then: { properties: { choice: false, other: false, optionNotes: false, changes: false, results: false, derived: false } }, $defs: { reference: { description: "AD-13's reference syntax without brackets: the item ID, then child IDs or a field, separated by dots; never an array index.", type: "string", pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, change: { description: "One operation of AD-20's generic diff, addressing elements by ID: add and move name the parent and the preceding sibling, each omitted when there is none (the top level, the first position).", oneOf: [{ $ref: "#/$defs/add" }, { $ref: "#/$defs/remove" }, { $ref: "#/$defs/move" }, { $ref: "#/$defs/set" }] }, add: { type: "object", properties: { op: { const: "add" }, target: { $ref: "#/$defs/reference" }, parent: { $ref: "urn:askboard:input:id" }, after: { $ref: "urn:askboard:input:id" }, value: {} }, required: ["op", "target", "value"], additionalProperties: false }, remove: { type: "object", properties: { op: { const: "remove" }, target: { $ref: "#/$defs/reference" } }, required: ["op", "target"], additionalProperties: false }, move: { type: "object", properties: { op: { const: "move" }, target: { $ref: "#/$defs/reference" }, parent: { $ref: "urn:askboard:input:id" }, after: { $ref: "urn:askboard:input:id" } }, required: ["op", "target"], additionalProperties: false }, set: { type: "object", properties: { op: { const: "set" }, target: { $ref: "#/$defs/reference" }, value: {} }, required: ["op", "target", "value"], additionalProperties: false } } };
var func6 = Object.prototype.hasOwnProperty;
var pattern22 = new RegExp("^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$", "u");
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.op === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "op" }, message: "must have required property '" + "op" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property '" + "target" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "op" || key0 === "target" || key0 === "parent" || key0 === "after" || key0 === "value")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.op !== undefined) {
      if (data.op !== "add") {
        const err4 = { instancePath: instancePath + "/op", schemaPath: "#/properties/op/const", keyword: "const", params: { allowedValue: "add" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target !== undefined) {
      let data1 = data.target;
      if (typeof data1 === "string") {
        if (!pattern22.test(data1)) {
          const err5 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.parent !== undefined) {
      let data2 = data.parent;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err7 = { instancePath: instancePath + "/parent", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/parent", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.after !== undefined) {
      let data3 = data.after;
      if (typeof data3 === "string") {
        if (!pattern12.test(data3)) {
          const err9 = { instancePath: instancePath + "/after", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/after", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate28.errors = vErrors;
  return errors === 0;
}
validate28.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.op === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "op" }, message: "must have required property '" + "op" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property '" + "target" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "op" || key0 === "target")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.op !== undefined) {
      if (data.op !== "remove") {
        const err3 = { instancePath: instancePath + "/op", schemaPath: "#/properties/op/const", keyword: "const", params: { allowedValue: "remove" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.target !== undefined) {
      let data1 = data.target;
      if (typeof data1 === "string") {
        if (!pattern22.test(data1)) {
          const err4 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.op === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "op" }, message: "must have required property '" + "op" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property '" + "target" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "op" || key0 === "target" || key0 === "parent" || key0 === "after")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.op !== undefined) {
      if (data.op !== "move") {
        const err3 = { instancePath: instancePath + "/op", schemaPath: "#/properties/op/const", keyword: "const", params: { allowedValue: "move" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.target !== undefined) {
      let data1 = data.target;
      if (typeof data1 === "string") {
        if (!pattern22.test(data1)) {
          const err4 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.parent !== undefined) {
      let data2 = data.parent;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err6 = { instancePath: instancePath + "/parent", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/parent", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.after !== undefined) {
      let data3 = data.after;
      if (typeof data3 === "string") {
        if (!pattern12.test(data3)) {
          const err8 = { instancePath: instancePath + "/after", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/after", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.op === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "op" }, message: "must have required property '" + "op" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property '" + "target" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "op" || key0 === "target" || key0 === "value")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.op !== undefined) {
      if (data.op !== "set") {
        const err4 = { instancePath: instancePath + "/op", schemaPath: "#/properties/op/const", keyword: "const", params: { allowedValue: "set" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target !== undefined) {
      let data1 = data.target;
      if (typeof data1 === "string") {
        if (!pattern22.test(data1)) {
          const err5 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/target", schemaPath: "#/$defs/reference/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate34.errors = vErrors;
  return errors === 0;
}
validate34.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate28(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors;
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors;
    if (!validate32(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors;
      if (!validate34(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate27.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate27.evaluated = { dynamicProps: true, dynamicItems: false };
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs1 = errors;
  let valid0 = true;
  const _errs2 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.declined === undefined && (missing0 = "declined")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    } else {
      if (data.declined !== undefined) {
        if (data.declined !== true) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      }
    }
  }
  var _valid0 = _errs2 === errors;
  errors = _errs1;
  if (vErrors !== null) {
    if (_errs1) {
      vErrors.length = _errs1;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs4 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.choice !== undefined) {
        const err2 = { instancePath: instancePath + "/choice", schemaPath: "#/then/properties/choice/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      if (data.other !== undefined) {
        const err3 = { instancePath: instancePath + "/other", schemaPath: "#/then/properties/other/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if (data.optionNotes !== undefined) {
        const err4 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/then/properties/optionNotes/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if (data.changes !== undefined) {
        const err5 = { instancePath: instancePath + "/changes", schemaPath: "#/then/properties/changes/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (data.results !== undefined) {
        const err6 = { instancePath: instancePath + "/results", schemaPath: "#/then/properties/results/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      if (data.derived !== undefined) {
        const err7 = { instancePath: instancePath + "/derived", schemaPath: "#/then/properties/derived/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    var _valid0 = _errs4 === errors;
    valid0 = _valid0;
    if (valid0) {
      var props0 = {};
      props0.choice = true;
      props0.other = true;
      props0.optionNotes = true;
      props0.changes = true;
      props0.results = true;
      props0.derived = true;
      props0.declined = true;
    }
  }
  if (!valid0) {
    const err8 = { instancePath, schemaPath: "#/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err9 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err10 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err11 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err12 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.who === undefined) {
      const err13 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "who" }, message: "must have required property '" + "who" + "'" };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.when === undefined) {
      const err14 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "when" }, message: "must have required property '" + "when" + "'" };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func6.call(schema50.properties, key0)) {
        const err15 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data7 = data.cursor;
      if (typeof data7 === "string") {
        if (!pattern13.test(data7)) {
          const err16 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "answer") {
        const err18 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "answer" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data9 = data.itemId;
      if (typeof data9 === "string") {
        if (!pattern12.test(data9)) {
          const err19 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data10 = data.rev;
      if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
        const err21 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      if (typeof data10 == "number" && isFinite(data10)) {
        if (data10 < 1 || isNaN(data10)) {
          const err22 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      }
    }
    if (data.who !== undefined) {
      let data11 = data.who;
      if (typeof data11 === "string") {
        if (func1(data11) > 256) {
          const err23 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (func1(data11) < 1) {
          const err24 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      } else {
        const err25 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      let data12 = data.when;
      if (typeof data12 === "string") {
        if (!pattern9.test(data12)) {
          const err26 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" }, message: 'must match pattern "' + "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" + '"' };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      } else {
        const err27 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.choice !== undefined) {
      let data13 = data.choice;
      if (Array.isArray(data13)) {
        if (data13.length < 1) {
          const err28 = { instancePath: instancePath + "/choice", schemaPath: "#/properties/choice/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        const len0 = data13.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data14 = data13[i0];
          if (typeof data14 === "string") {
            if (func1(data14) < 1) {
              const err29 = { instancePath: instancePath + "/choice/" + i0, schemaPath: "#/properties/choice/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err29];
              } else {
                vErrors.push(err29);
              }
              errors++;
            }
          } else {
            const err30 = { instancePath: instancePath + "/choice/" + i0, schemaPath: "#/properties/choice/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
        let i1 = data13.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (;i1--; ) {
            let item0 = data13[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err31 = { instancePath: instancePath + "/choice", schemaPath: "#/properties/choice/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err32 = { instancePath: instancePath + "/choice", schemaPath: "#/properties/choice/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.other !== undefined) {
      let data15 = data.other;
      if (typeof data15 === "string") {
        if (func1(data15) > 1e4) {
          const err33 = { instancePath: instancePath + "/other", schemaPath: "#/properties/other/maxLength", keyword: "maxLength", params: { limit: 1e4 }, message: "must NOT have more than 10000 characters" };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (func1(data15) < 1) {
          const err34 = { instancePath: instancePath + "/other", schemaPath: "#/properties/other/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
      } else {
        const err35 = { instancePath: instancePath + "/other", schemaPath: "#/properties/other/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.optionNotes !== undefined) {
      let data16 = data.optionNotes;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (Object.keys(data16).length < 1) {
          const err36 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/properties/optionNotes/minProperties", keyword: "minProperties", params: { limit: 1 }, message: "must NOT have fewer than 1 properties" };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        for (const key1 in data16) {
          const _errs28 = errors;
          if (typeof key1 === "string") {
            if (func1(key1) < 1) {
              const err37 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/properties/optionNotes/propertyNames/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters", propertyName: key1 };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
          } else {
            const err38 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/properties/optionNotes/propertyNames/type", keyword: "type", params: { type: "string" }, message: "must be string", propertyName: key1 };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
          var valid10 = _errs28 === errors;
          if (!valid10) {
            const err39 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/properties/optionNotes/propertyNames", keyword: "propertyNames", params: { propertyName: key1 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
        for (const key2 in data16) {
          let data17 = data16[key2];
          if (typeof data17 === "string") {
            if (func1(data17) > 2000) {
              const err40 = { instancePath: instancePath + "/optionNotes/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/optionNotes/additionalProperties/maxLength", keyword: "maxLength", params: { limit: 2000 }, message: "must NOT have more than 2000 characters" };
              if (vErrors === null) {
                vErrors = [err40];
              } else {
                vErrors.push(err40);
              }
              errors++;
            }
            if (func1(data17) < 1) {
              const err41 = { instancePath: instancePath + "/optionNotes/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/optionNotes/additionalProperties/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
          } else {
            const err42 = { instancePath: instancePath + "/optionNotes/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/optionNotes/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err42];
            } else {
              vErrors.push(err42);
            }
            errors++;
          }
        }
      } else {
        const err43 = { instancePath: instancePath + "/optionNotes", schemaPath: "#/properties/optionNotes/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.note !== undefined) {
      let data18 = data.note;
      if (typeof data18 === "string") {
        if (func1(data18) > 1e4) {
          const err44 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/maxLength", keyword: "maxLength", params: { limit: 1e4 }, message: "must NOT have more than 10000 characters" };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        if (func1(data18) < 1) {
          const err45 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
      } else {
        const err46 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.changes !== undefined) {
      let data19 = data.changes;
      if (Array.isArray(data19)) {
        if (data19.length < 1) {
          const err47 = { instancePath: instancePath + "/changes", schemaPath: "#/properties/changes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        const len1 = data19.length;
        for (let i2 = 0;i2 < len1; i2++) {
          if (!validate27(data19[i2], { instancePath: instancePath + "/changes/" + i2, parentData: data19, parentDataProperty: i2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err48 = { instancePath: instancePath + "/changes", schemaPath: "#/properties/changes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
    }
    if (data.results !== undefined) {
      let data21 = data.results;
      if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
        for (const key3 in data21) {
          const _errs40 = errors;
          if (typeof key3 === "string") {
            if (!pattern12.test(key3)) {
              const err49 = { instancePath: instancePath + "/results", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"', propertyName: key3 };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          } else {
            const err50 = { instancePath: instancePath + "/results", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string", propertyName: key3 };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
          var valid14 = _errs40 === errors;
          if (!valid14) {
            const err51 = { instancePath: instancePath + "/results", schemaPath: "#/properties/results/propertyNames", keyword: "propertyNames", params: { propertyName: key3 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err51];
            } else {
              vErrors.push(err51);
            }
            errors++;
          }
        }
      } else {
        const err52 = { instancePath: instancePath + "/results", schemaPath: "#/properties/results/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.derived !== undefined) {
      let data22 = data.derived;
      if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
        for (const key4 in data22) {
          const _errs45 = errors;
          if (typeof key4 === "string") {
            if (!pattern22.test(key4)) {
              const err53 = { instancePath: instancePath + "/derived", schemaPath: "#/$defs/reference/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$" + '"', propertyName: key4 };
              if (vErrors === null) {
                vErrors = [err53];
              } else {
                vErrors.push(err53);
              }
              errors++;
            }
          } else {
            const err54 = { instancePath: instancePath + "/derived", schemaPath: "#/$defs/reference/type", keyword: "type", params: { type: "string" }, message: "must be string", propertyName: key4 };
            if (vErrors === null) {
              vErrors = [err54];
            } else {
              vErrors.push(err54);
            }
            errors++;
          }
          var valid16 = _errs45 === errors;
          if (!valid16) {
            const err55 = { instancePath: instancePath + "/derived", schemaPath: "#/properties/derived/propertyNames", keyword: "propertyNames", params: { propertyName: key4 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err55];
            } else {
              vErrors.push(err55);
            }
            errors++;
          }
        }
      } else {
        const err56 = { instancePath: instancePath + "/derived", schemaPath: "#/properties/derived/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err56];
        } else {
          vErrors.push(err56);
        }
        errors++;
      }
    }
    if (data.declined !== undefined) {
      if (data.declined !== true) {
        const err57 = { instancePath: instancePath + "/declined", schemaPath: "#/properties/declined/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err57];
        } else {
          vErrors.push(err57);
        }
        errors++;
      }
    }
    if (data.replaces !== undefined) {
      let data24 = data.replaces;
      if (typeof data24 === "string") {
        if (!pattern13.test(data24)) {
          const err58 = { instancePath: instancePath + "/replaces", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
      } else {
        const err59 = { instancePath: instancePath + "/replaces", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
    }
    if (data.tooLarge !== undefined) {
      if (data.tooLarge !== true) {
        const err60 = { instancePath: instancePath + "/tooLarge", schemaPath: "#/properties/tooLarge/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
    if (data.tooLarge !== undefined) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.changes !== undefined) {
          const err61 = { instancePath: instancePath + "/changes", schemaPath: "#/dependentSchemas/tooLarge/properties/changes/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        if (data.results !== undefined) {
          const err62 = { instancePath: instancePath + "/results", schemaPath: "#/dependentSchemas/tooLarge/properties/results/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
        if (data.derived !== undefined) {
          const err63 = { instancePath: instancePath + "/derived", schemaPath: "#/dependentSchemas/tooLarge/properties/derived/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
          if (vErrors === null) {
            vErrors = [err63];
          } else {
            vErrors.push(err63);
          }
          errors++;
        }
      }
    }
  } else {
    const err64 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err64];
    } else {
      vErrors.push(err64);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema70 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:askboard:output:discarded-event", title: "Discarded event", description: "The final event of a discarded ask (AD-21): its unsent answers will not come. An ask is discarded at session exit, or when its board is gone and none reconnects within the grace period (board-closed).", type: "object", properties: { cursor: { $ref: "urn:askboard:output:cursor" }, type: { const: "discarded" }, reason: { enum: ["session-exit", "board-closed"] } }, required: ["cursor", "type", "reason"], additionalProperties: false };
function validate38(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate38.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.reason === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "reason" }, message: "must have required property '" + "reason" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "reason")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err4 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "discarded") {
        const err6 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "discarded" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.reason !== undefined) {
      let data2 = data.reason;
      if (!(data2 === "session-exit" || data2 === "board-closed")) {
        const err7 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/enum", keyword: "enum", params: { allowedValues: schema70.properties.reason.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
  } else {
    const err8 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate38.errors = vErrors;
  return errors === 0;
}
validate38.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate40(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate40.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "itemId" || key0 === "rev")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err5 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "postponed") {
        const err7 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "postponed" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data2 = data.itemId;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err8 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data3 = data.rev;
      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
        const err10 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err11 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate40.errors = vErrors;
  return errors === 0;
}
validate40.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate42(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate42.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "itemId" || key0 === "rev")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err5 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "reopened") {
        const err7 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "reopened" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data2 = data.itemId;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err8 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data3 = data.rev;
      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
        const err10 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err11 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate42.errors = vErrors;
  return errors === 0;
}
validate42.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate44(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.who === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "who" }, message: "must have required property '" + "who" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.when === undefined) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "when" }, message: "must have required property '" + "when" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.note === undefined) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "note" }, message: "must have required property '" + "note" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "itemId" || key0 === "rev" || key0 === "who" || key0 === "when" || key0 === "note")) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err8 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "note") {
        const err10 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "note" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data2 = data.itemId;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err11 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data3 = data.rev;
      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
        const err13 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err14 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
    }
    if (data.who !== undefined) {
      let data4 = data.who;
      if (typeof data4 === "string") {
        if (func1(data4) > 256) {
          const err15 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func1(data4) < 1) {
          const err16 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      let data5 = data.when;
      if (typeof data5 === "string") {
        if (!pattern9.test(data5)) {
          const err18 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" }, message: 'must match pattern "' + "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" + '"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.note !== undefined) {
      let data6 = data.note;
      if (typeof data6 === "string") {
        if (func1(data6) > 1e4) {
          const err20 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/maxLength", keyword: "maxLength", params: { limit: 1e4 }, message: "must NOT have more than 10000 characters" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (func1(data6) < 1) {
          const err21 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = { instancePath: instancePath + "/note", schemaPath: "#/properties/note/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
  } else {
    const err23 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate44.errors = vErrors;
  return errors === 0;
}
validate44.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate46(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.who === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "who" }, message: "must have required property '" + "who" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.when === undefined) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "when" }, message: "must have required property '" + "when" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.text === undefined) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "text" }, message: "must have required property '" + "text" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "itemId" || key0 === "rev" || key0 === "who" || key0 === "when" || key0 === "text")) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err8 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "follow-up") {
        const err10 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "follow-up" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data2 = data.itemId;
      if (typeof data2 === "string") {
        if (!pattern12.test(data2)) {
          const err11 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data3 = data.rev;
      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
        const err13 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err14 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
    }
    if (data.who !== undefined) {
      let data4 = data.who;
      if (typeof data4 === "string") {
        if (func1(data4) > 256) {
          const err15 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func1(data4) < 1) {
          const err16 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/who", schemaPath: "#/properties/who/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      let data5 = data.when;
      if (typeof data5 === "string") {
        if (!pattern9.test(data5)) {
          const err18 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" }, message: 'must match pattern "' + "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$" + '"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/when", schemaPath: "urn:askboard:output:time/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.text !== undefined) {
      let data6 = data.text;
      if (typeof data6 === "string") {
        if (func1(data6) > 1e4) {
          const err20 = { instancePath: instancePath + "/text", schemaPath: "#/properties/text/maxLength", keyword: "maxLength", params: { limit: 1e4 }, message: "must NOT have more than 10000 characters" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (func1(data6) < 1) {
          const err21 = { instancePath: instancePath + "/text", schemaPath: "#/properties/text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = { instancePath: instancePath + "/text", schemaPath: "#/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
  } else {
    const err23 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema86 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:askboard:output:edit-choice-event", title: "Edit choice event", description: "What the user chose when the agent changed a question they had unsent work on (FR-6, AD-20), at the question's current revision: reload, dropping the work, or ignore, keeping it, with keptRev naming the earlier revision an answer may then name.", type: "object", properties: { cursor: { $ref: "urn:askboard:output:cursor" }, type: { const: "edit-choice" }, itemId: { $ref: "urn:askboard:input:id" }, rev: { type: "integer", minimum: 1 }, edit: { enum: ["reload", "ignore"] }, keptRev: { type: "integer", minimum: 1 } }, required: ["cursor", "type", "itemId", "rev", "edit"], additionalProperties: false, if: { properties: { edit: { const: "ignore" } } }, then: { properties: { keptRev: true }, required: ["keptRev"] }, else: { properties: { keptRev: false } } };
function validate48(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate48.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs1 = errors;
  let valid0 = true;
  const _errs2 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.edit !== undefined) {
      if (data.edit !== "ignore") {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs2 === errors;
  errors = _errs1;
  if (vErrors !== null) {
    if (_errs1) {
      vErrors.length = _errs1;
    } else {
      vErrors = null;
    }
  }
  let ifClause0;
  if (_valid0) {
    const _errs4 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.keptRev === undefined) {
        const err1 = { instancePath, schemaPath: "#/then/required", keyword: "required", params: { missingProperty: "keptRev" }, message: "must have required property '" + "keptRev" + "'" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    var _valid0 = _errs4 === errors;
    valid0 = _valid0;
    if (valid0) {
      var props0 = {};
      props0.keptRev = true;
      props0.edit = true;
    }
    ifClause0 = "then";
  } else {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.keptRev !== undefined) {
        const err2 = { instancePath: instancePath + "/keptRev", schemaPath: "#/else/properties/keptRev/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    var _valid0 = _errs5 === errors;
    valid0 = _valid0;
    if (valid0) {
      if (props0 !== true) {
        props0 = props0 || {};
        props0.keptRev = true;
      }
    }
    ifClause0 = "else";
  }
  if (!valid0) {
    const err3 = { instancePath, schemaPath: "#/if", keyword: "if", params: { failingKeyword: ifClause0 }, message: 'must match "' + ifClause0 + '" schema' };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.itemId === undefined) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "itemId" }, message: "must have required property '" + "itemId" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.rev === undefined) {
      const err7 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rev" }, message: "must have required property '" + "rev" + "'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.edit === undefined) {
      const err8 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "edit" }, message: "must have required property '" + "edit" + "'" };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "itemId" || key0 === "rev" || key0 === "edit" || key0 === "keptRev")) {
        const err9 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data2 = data.cursor;
      if (typeof data2 === "string") {
        if (!pattern13.test(data2)) {
          const err10 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "edit-choice") {
        const err12 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "edit-choice" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.itemId !== undefined) {
      let data4 = data.itemId;
      if (typeof data4 === "string") {
        if (!pattern12.test(data4)) {
          const err13 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/itemId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.rev !== undefined) {
      let data5 = data.rev;
      if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
        const err15 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      if (typeof data5 == "number" && isFinite(data5)) {
        if (data5 < 1 || isNaN(data5)) {
          const err16 = { instancePath: instancePath + "/rev", schemaPath: "#/properties/rev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      }
    }
    if (data.edit !== undefined) {
      let data6 = data.edit;
      if (!(data6 === "reload" || data6 === "ignore")) {
        const err17 = { instancePath: instancePath + "/edit", schemaPath: "#/properties/edit/enum", keyword: "enum", params: { allowedValues: schema86.properties.edit.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.keptRev !== undefined) {
      let data7 = data.keptRev;
      if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
        const err18 = { instancePath: instancePath + "/keptRev", schemaPath: "#/properties/keptRev/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (typeof data7 == "number" && isFinite(data7)) {
        if (data7 < 1 || isNaN(data7)) {
          const err19 = { instancePath: instancePath + "/keptRev", schemaPath: "#/properties/keptRev/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
    }
  } else {
    const err20 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err20];
    } else {
      vErrors.push(err20);
    }
    errors++;
  }
  validate48.errors = vErrors;
  return errors === 0;
}
validate48.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema89 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:askboard:output:closed-event", title: "Closed event", description: "The final event of an ask AskBoard closed, not the agent: its owner, a subagent, finished (AD-3, AD-10), and the ask takes no more answers. An agent's own close is reported in its call's result and is not an event.", type: "object", properties: { cursor: { $ref: "urn:askboard:output:cursor" }, type: { const: "closed" }, reason: { enum: ["agent-finished"] } }, required: ["cursor", "type", "reason"], additionalProperties: false };
function validate50(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate50.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.cursor === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.reason === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "reason" }, message: "must have required property '" + "reason" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "cursor" || key0 === "type" || key0 === "reason")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data0 = data.cursor;
      if (typeof data0 === "string") {
        if (!pattern13.test(data0)) {
          const err4 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "closed") {
        const err6 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "closed" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.reason !== undefined) {
      if (!(data.reason === "agent-finished")) {
        const err7 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/enum", keyword: "enum", params: { allowedValues: schema89.properties.reason.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
  } else {
    const err8 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate50.errors = vErrors;
  return errors === 0;
}
validate50.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate54(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate54.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate26(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors;
  if (!validate38(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate38.errors : vErrors.concat(validate38.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors;
    if (!validate40(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate40.errors : vErrors.concat(validate40.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors;
      if (!validate42(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate42.errors : vErrors.concat(validate42.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs5 = errors;
        if (!validate44(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs6 = errors;
          if (!validate46(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
            errors = vErrors.length;
          }
          var _valid0 = _errs6 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
            const _errs7 = errors;
            if (!validate48(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
              errors = vErrors.length;
            }
            var _valid0 = _errs7 === errors;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = true;
                }
              }
              const _errs8 = errors;
              if (!validate50(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate50.errors : vErrors.concat(validate50.errors);
                errors = vErrors.length;
              }
              var _valid0 = _errs8 === errors;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate54.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate54.evaluated = { dynamicProps: true, dynamicItems: false };
function validate22(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.askId === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "askId" }, message: "must have required property '" + "askId" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.state === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "state" }, message: "must have required property '" + "state" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.cursor === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cursor" }, message: "must have required property '" + "cursor" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.events === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "events" }, message: "must have required property '" + "events" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "askId" || key0 === "agent_id" || key0 === "state" || key0 === "cursor" || key0 === "events")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.askId !== undefined) {
      let data0 = data.askId;
      if (typeof data0 === "string") {
        if (!pattern12.test(data0)) {
          const err5 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.agent_id !== undefined) {
      let data1 = data.agent_id;
      if (typeof data1 === "string") {
        if (func1(data1) > 256) {
          const err7 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func1(data1) < 1) {
          const err8 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.state !== undefined) {
      let data2 = data.state;
      if (!(data2 === "waiting" || data2 === "partly-answered" || data2 === "answered" || data2 === "closed" || data2 === "discarded")) {
        const err10 = { instancePath: instancePath + "/state", schemaPath: "urn:askboard:output:ask-state/enum", keyword: "enum", params: { allowedValues: schema40.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.cursor !== undefined) {
      let data3 = data.cursor;
      if (typeof data3 === "string") {
        if (!pattern13.test(data3)) {
          const err11 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$" + '"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/cursor", schemaPath: "urn:askboard:output:cursor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.events !== undefined) {
      let data4 = data.events;
      if (Array.isArray(data4)) {
        if (data4.length < 1) {
          const err13 = { instancePath: instancePath + "/events", schemaPath: "#/properties/events/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate54(data4[i0], { instancePath: instancePath + "/events/" + i0, parentData: data4, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate54.errors : vErrors.concat(validate54.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err14 = { instancePath: instancePath + "/events", schemaPath: "#/properties/events/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
  } else {
    const err15 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var pattern167 = new RegExp("^http://127\\.0\\.0\\.1:[1-9][0-9]{0,4}/b/[A-Za-z0-9_-]{1,64}\\?t=[A-Za-z0-9_-]{22,256}$", "u");
function validate65(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate65.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.askId === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "askId" }, message: "must have required property '" + "askId" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.title === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property '" + "title" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.openQuestions === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "openQuestions" }, message: "must have required property '" + "openQuestions" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.link === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "link" }, message: "must have required property '" + "link" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "askId" || key0 === "title" || key0 === "label" || key0 === "agentName" || key0 === "openQuestions" || key0 === "link" || key0 === "agent_id")) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.askId !== undefined) {
      let data0 = data.askId;
      if (typeof data0 === "string") {
        if (!pattern12.test(data0)) {
          const err6 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.title !== undefined) {
      let data1 = data.title;
      if (typeof data1 === "string") {
        if (func1(data1) > 256) {
          const err8 = { instancePath: instancePath + "/title", schemaPath: "urn:askboard:board-document:board-document#/properties/title/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func1(data1) < 1) {
          const err9 = { instancePath: instancePath + "/title", schemaPath: "urn:askboard:board-document:board-document#/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/title", schemaPath: "urn:askboard:board-document:board-document#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func1(data2) > 512) {
          const err11 = { instancePath: instancePath + "/label", schemaPath: "urn:askboard:board-protocol:origin#/$defs/label/maxLength", keyword: "maxLength", params: { limit: 512 }, message: "must NOT have more than 512 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func1(data2) < 1) {
          const err12 = { instancePath: instancePath + "/label", schemaPath: "urn:askboard:board-protocol:origin#/$defs/label/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/label", schemaPath: "urn:askboard:board-protocol:origin#/$defs/label/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.agentName !== undefined) {
      let data3 = data.agentName;
      if (typeof data3 === "string") {
        if (func1(data3) > 256) {
          const err14 = { instancePath: instancePath + "/agentName", schemaPath: "urn:askboard:input:ask#/properties/agentName/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func1(data3) < 1) {
          const err15 = { instancePath: instancePath + "/agentName", schemaPath: "urn:askboard:input:ask#/properties/agentName/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/agentName", schemaPath: "urn:askboard:input:ask#/properties/agentName/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.openQuestions !== undefined) {
      let data4 = data.openQuestions;
      if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
        const err17 = { instancePath: instancePath + "/openQuestions", schemaPath: "#/properties/openQuestions/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
      if (typeof data4 == "number" && isFinite(data4)) {
        if (data4 < 1 || isNaN(data4)) {
          const err18 = { instancePath: instancePath + "/openQuestions", schemaPath: "#/properties/openQuestions/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      }
    }
    if (data.link !== undefined) {
      let data5 = data.link;
      if (typeof data5 === "string") {
        if (!pattern167.test(data5)) {
          const err19 = { instancePath: instancePath + "/link", schemaPath: "urn:askboard:tool-envelopes:ask-result#/properties/board/pattern", keyword: "pattern", params: { pattern: "^http://127\\.0\\.0\\.1:[1-9][0-9]{0,4}/b/[A-Za-z0-9_-]{1,64}\\?t=[A-Za-z0-9_-]{22,256}$" }, message: 'must match pattern "' + "^http://127\\.0\\.0\\.1:[1-9][0-9]{0,4}/b/[A-Za-z0-9_-]{1,64}\\?t=[A-Za-z0-9_-]{22,256}$" + '"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/link", schemaPath: "urn:askboard:tool-envelopes:ask-result#/properties/board/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.agent_id !== undefined) {
      let data6 = data.agent_id;
      if (typeof data6 === "string") {
        if (func1(data6) > 256) {
          const err21 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func1(data6) < 1) {
          const err22 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = { instancePath: instancePath + "/agent_id", schemaPath: "urn:askboard:local-api:agent-id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
  } else {
    const err24 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors++;
  }
  validate65.errors = vErrors;
  return errors === 0;
}
validate65.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate325(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate325.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.askId === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "askId" }, message: "must have required property '" + "askId" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.seq === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "seq" }, message: "must have required property '" + "seq" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "askId" || key0 === "seq")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.askId !== undefined) {
      let data0 = data.askId;
      if (typeof data0 === "string") {
        if (!pattern12.test(data0)) {
          const err3 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]{1,64}$" }, message: 'must match pattern "' + "^[A-Za-z0-9_-]{1,64}$" + '"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/askId", schemaPath: "urn:askboard:input:id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.seq !== undefined) {
      let data1 = data.seq;
      if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
        const err5 = { instancePath: instancePath + "/seq", schemaPath: "#/properties/seq/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 < 0 || isNaN(data1)) {
          const err6 = { instancePath: instancePath + "/seq", schemaPath: "#/properties/seq/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate325.errors = vErrors;
  return errors === 0;
}
validate325.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.version === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "version" }, message: "must have required property '" + "version" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.epoch === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "epoch" }, message: "must have required property '" + "epoch" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.asks === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "asks" }, message: "must have required property '" + "asks" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.pending === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "pending" }, message: "must have required property '" + "pending" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "version" || key0 === "epoch" || key0 === "asks" || key0 === "pending" || key0 === "more" || key0 === "continuation")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data0 = data.version;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err5 = { instancePath: instancePath + "/version", schemaPath: "urn:askboard:local-api:version/pattern", keyword: "pattern", params: { pattern: "^1\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "' + "^1\\.(0|[1-9][0-9]*)$" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/version", schemaPath: "urn:askboard:local-api:version/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.epoch !== undefined) {
      let data1 = data.epoch;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err7 = { instancePath: instancePath + "/epoch", schemaPath: "urn:askboard:output:epoch/pattern", keyword: "pattern", params: { pattern: "^[a-z0-9]{4,16}$" }, message: 'must match pattern "' + "^[a-z0-9]{4,16}$" + '"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/epoch", schemaPath: "urn:askboard:output:epoch/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.asks !== undefined) {
      let data2 = data.asks;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate22(data2[i0], { instancePath: instancePath + "/asks/" + i0, parentData: data2, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err9 = { instancePath: instancePath + "/asks", schemaPath: "#/properties/asks/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.pending !== undefined) {
      let data4 = data.pending;
      if (Array.isArray(data4)) {
        const len1 = data4.length;
        for (let i1 = 0;i1 < len1; i1++) {
          if (!validate65(data4[i1], { instancePath: instancePath + "/pending/" + i1, parentData: data4, parentDataProperty: i1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate65.errors : vErrors.concat(validate65.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err10 = { instancePath: instancePath + "/pending", schemaPath: "#/properties/pending/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.more !== undefined) {
      if (data.more !== true) {
        const err11 = { instancePath: instancePath + "/more", schemaPath: "#/properties/more/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.continuation !== undefined) {
      if (!validate325(data.continuation, { instancePath: instancePath + "/continuation", parentData: data, parentDataProperty: "continuation", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate325.errors : vErrors.concat(validate325.errors);
        errors = vErrors.length;
      }
    }
    if (data.more !== undefined) {
      if (data.continuation === undefined) {
        const err12 = { instancePath, schemaPath: "#/dependentRequired", keyword: "dependentRequired", params: {
          property: "more",
          missingProperty: "continuation",
          depsCount: 1,
          deps: "continuation"
        }, message: "must have property continuation when property more is present" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.continuation !== undefined) {
      if (data.more === undefined) {
        const err13 = { instancePath, schemaPath: "#/dependentRequired", keyword: "dependentRequired", params: {
          property: "continuation",
          missingProperty: "more",
          depsCount: 1,
          deps: "more"
        }, message: "must have property more when property continuation is present" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var ack = validate327;
function validate327(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate327.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.version === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "version" }, message: "must have required property '" + "version" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "version")) {
        const err1 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data0 = data.version;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err2 = { instancePath: instancePath + "/version", schemaPath: "urn:askboard:local-api:version/pattern", keyword: "pattern", params: { pattern: "^1\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "' + "^1\\.(0|[1-9][0-9]*)$" + '"' };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = { instancePath: instancePath + "/version", schemaPath: "urn:askboard:local-api:version/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate327.errors = vErrors;
  return errors === 0;
}
validate327.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var checks = { sessionFile, poll, ack };

// packages/mod/src/locate.ts
var PID_COMMAND = ["sh", "-c", `printf '%s %s' "$PPID" "$(id -u)"`];
var PID_AND_UID = /^([1-9][0-9]*) (0|[1-9][0-9]*)$/;
var CHECK_TIMEOUT_MS = 2000;
const privateCheck = (path, type, uid, mode) => [
  "find",
  path,
  "-maxdepth",
  "0",
  "-type",
  type,
  "-uid",
  `${uid}`,
  "-perm",
  mode
];
const locate = async ($) => {
  let printed;
  try {
    const ran = await $.process.run(PID_COMMAND);
    if (ran.exitCode !== 0)
      return;
    printed = ran.stdout.trim();
  } catch {
    return;
  }
  const match = PID_AND_UID.exec(printed);
  if (match === null)
    return;
  const key = Number(match[1]);
  const uid = Number(match[2]);
  const env = {
    XDG_RUNTIME_DIR: await $.env.get("XDG_RUNTIME_DIR"),
    TMPDIR: await $.env.get("TMPDIR")
  };
  try {
    const folder = sessionFolder({ env, uid });
    return { key, uid, folder, file: sessionFilePath(folder, key) };
  } catch {
    return;
  }
};
const passes = async ($, argv, path) => {
  try {
    const ran = await $.process.run(argv, { timeoutMs: CHECK_TIMEOUT_MS });
    return ran.exitCode === 0 && ran.stdout === `${path}
`;
  } catch {
    return false;
  }
};
const isPrivate = async ($, { uid, folder, file }) => await passes($, privateCheck(folder, "d", uid, "700"), folder) && await passes($, privateCheck(file, "f", uid, "600"), file);
const statOf = async ($, path) => {
  try {
    return await $.fs.stat(path);
  } catch {
    return;
  }
};
const readSession = async ($, location) => {
  const folder = await statOf($, location.folder);
  if (folder?.kind !== "dir" || folder.isLink)
    return;
  const file = await statOf($, location.file);
  if (file?.kind !== "file" || file.isLink)
    return;
  let value;
  try {
    value = JSON.parse(await $.fs.read(location.file));
  } catch {
    return;
  }
  if (!checks.sessionFile(value))
    return;
  const session = value;
  const matches = session.key === location.key && session.apiAddress === socketPathFor(location.folder, location.key);
  return matches ? session : undefined;
};

// packages/mod/src/push-message.ts
const eventKey = (askId, cursor) => `${askId} ${cursor}`;
const keysOf = (asks) => asks.flatMap((ask) => ask.events.map((event) => eventKey(ask.askId, event.cursor)));
const seqOf = (cursor) => Number(cursor.slice(cursor.lastIndexOf(".") + 1));
const lastCursor = (ask) => ask.events.reduce((last, event) => seqOf(event.cursor) > seqOf(last) ? event.cursor : last, "");
const pushText = (epoch, asks) => pushMessageText({
  versions: { output: OUTPUT_FORMAT_VERSION },
  epoch,
  asks
});
const merged = (asks) => {
  const byAsk = new Map;
  for (const ask of asks) {
    const known = byAsk.get(ask.askId);
    if (known === undefined) {
      byAsk.set(ask.askId, ask);
      continue;
    }
    const events = new Map(known.events.map((event) => [event.cursor, event]));
    for (const event of ask.events)
      events.set(event.cursor, event);
    const latest = seqOf(ask.cursor) >= seqOf(known.cursor) ? ask : known;
    byAsk.set(ask.askId, {
      askId: ask.askId,
      state: latest.state,
      cursor: latest.cursor,
      events: [...events.values()].sort((a, b) => seqOf(a.cursor) - seqOf(b.cursor))
    });
  }
  return [...byAsk.values()];
};

// packages/mod/src/transport.ts
const clientCommand = (pluginRoot) => [
  "sh",
  `${pluginRoot}/scripts/askboard`,
  "client"
];
var CLIENT_EXIT = { answered: 0, refused: 3 };
var CLIENT_TIMEOUT_MS = 5000;
var REFUSALS_TO_PIN = 3;
var FAILED = { kind: "failed" };
const parsed = (text) => {
  try {
    return { kind: "answered", body: JSON.parse(text) };
  } catch {
    return FAILED;
  }
};
const answerOf = (response) => response.status === 200 ? parsed(response.text) : { kind: "refused", status: response.status };
const viaFetch = async ($, session, { method, path, body }) => {
  const headers = { [SESSION_TOKEN_HEADER]: session.sessionToken };
  if (body !== undefined)
    headers["Content-Type"] = "application/json";
  const response = await $.http.fetch(`http://${LOCAL_API_HOST}${path}`, {
    method,
    headers,
    ...body === undefined ? {} : { body: JSON.stringify(body) },
    socketPath: session.apiAddress
  });
  return answerOf(response);
};
const refusalOf = (stdout) => {
  const answer = parsed(stdout);
  if (answer.kind !== "answered")
    return FAILED;
  const { status } = answer.body ?? {};
  return Number.isInteger(status) ? { kind: "refused", status } : FAILED;
};
const viaClient = async ($, { path, body }) => {
  const argv = [
    ...clientCommand($.plugin.root),
    path,
    ...body === undefined ? [] : [JSON.stringify(body)]
  ];
  try {
    const ran = await $.process.run(argv, { timeoutMs: CLIENT_TIMEOUT_MS });
    if (ran.exitCode === CLIENT_EXIT.answered)
      return parsed(ran.stdout);
    if (ran.exitCode === CLIENT_EXIT.refused)
      return refusalOf(ran.stdout);
    return FAILED;
  } catch {
    return FAILED;
  }
};
const countRefusal = (memory, $, session) => {
  const known = memory.refusedFetches;
  const same = known?.pid === session.pid && known.epoch === session.epoch;
  const count = same ? known.count + 1 : 1;
  memory.refusedFetches = { pid: session.pid, epoch: session.epoch, count };
  if (count < REFUSALS_TO_PIN)
    return;
  memory.transport = "client";
  debug($, "$.http.fetch is refused: the local API is reached through the AskBoard client");
};
const afterFailedFetch = async (memory, $, session, request) => {
  if (memory.polls < memory.probeAfter)
    return FAILED;
  const answer = await viaClient($, request);
  if (answer.kind === "failed") {
    memory.probeAfter = memory.polls + 1;
    return FAILED;
  }
  countRefusal(memory, $, session);
  return answer;
};
const send = async (memory, $, session, request) => {
  if (memory.transport === "client")
    return viaClient($, request);
  let answer;
  try {
    answer = await viaFetch($, session, request);
  } catch {
    return afterFailedFetch(memory, $, session, request);
  }
  memory.refusedFetches = undefined;
  return answer;
};
const isFinalRefusal = (status) => status >= 400 && status < 500;

// packages/mod/src/reports.ts
var ROUTE = LOCAL_API_ROUTES.delivered.path;
const keep = (memory, report) => {
  const waiting = memory.unreported.get(report.askId);
  if (waiting !== undefined && seqOf(waiting.cursor) >= seqOf(report.cursor))
    return;
  memory.unreported.set(report.askId, report);
};
const settled = (memory, report) => {
  const waiting = memory.unreported.get(report.askId);
  if (waiting !== undefined && seqOf(waiting.cursor) <= seqOf(report.cursor)) {
    memory.unreported.delete(report.askId);
  }
};
const sendReport = async (memory, $, epoch, report) => {
  const session = memory.session;
  if (session === undefined || session.epoch !== epoch)
    return;
  const answer = await send(memory, $, session, {
    method: "POST",
    path: ROUTE,
    body: { version: LOCAL_API_VERSION, ...report }
  });
  if (answer.kind === "refused") {
    debugOnce(memory, $, `POST ${ROUTE} was refused with ${answer.status}`);
  }
  const done = answer.kind === "refused" ? isFinalRefusal(answer.status) : answer.kind === "answered" && checks.ack(answer.body);
  if (done)
    settled(memory, report);
  else if (memory.session?.epoch === epoch)
    keep(memory, report);
};
const reportDelivered = async (memory, $, epoch, asks, via) => {
  for (const ask of asks) {
    await sendReport(memory, $, epoch, { askId: ask.askId, cursor: lastCursor(ask), via });
  }
};
const queueReports = (memory, asks, via) => {
  for (const ask of asks)
    keep(memory, { askId: ask.askId, cursor: lastCursor(ask), via });
};
const retryReports = async (memory, $, epoch) => {
  for (const report of [...memory.unreported.values()]) {
    await sendReport(memory, $, epoch, report);
  }
};

// packages/mod/src/deliver.ts
const markPushed = (memory, asks) => {
  for (const key of keysOf(asks))
    memory.pushed.add(key);
};
const unmarkPushed = (memory, epoch, asks) => {
  if (memory.session?.epoch !== epoch)
    return;
  for (const key of keysOf(asks))
    memory.pushed.delete(key);
};
const appendPush = async ($, epoch, asks, agentId) => {
  try {
    const stored = await $.session.append({
      message: { type: "user", content: [{ type: "text", text: pushText(epoch, asks) }] },
      ...agentId === undefined ? {} : { agentId }
    });
    return stored.deny === undefined;
  } catch {
    return false;
  }
};
const sendPush = async ($, epoch, asks, agentId) => {
  try {
    const sent = await $.session.send({ to: { agentId }, text: pushText(epoch, asks) });
    return sent.isDelivered === true;
  } catch {
    return false;
  }
};
const submitPush = (memory, $, epoch, asks, outcomes) => {
  const current = () => memory.session?.epoch === epoch;
  $.prompt.submit({ text: pushText(epoch, asks) }).then(async (result) => {
    if (!current())
      return;
    if (result.drop !== undefined) {
      outcomes.dropped(asks);
      return;
    }
    await reportDelivered(memory, $, epoch, asks, "submit");
  }, () => {
    if (current())
      outcomes.failed(asks);
  }).catch(() => debug($, "a submitted push could not be followed up"));
};

// packages/mod/src/carried.ts
var SECOND_REQUEST = 2;
const carriedFrom = (steps) => steps === 0 ? SECOND_REQUEST : steps + 1;
const isCarried = (row, steps) => steps >= row.carriedFrom;

// packages/mod/src/subagent-turns.ts
const freshTurn = (memory, agentId) => {
  memory.subagentTurns += 1;
  const turn = { serial: memory.subagentTurns, steps: 0, appended: [] };
  memory.subagents.set(agentId, turn);
  return turn;
};
const turnOf = (memory, agentId) => memory.subagents.get(agentId) ?? freshTurn(memory, agentId);
const subagentTurnAt = (memory, agentId) => turnOf(memory, agentId).serial;
const subagentAppended = (memory, agentId, serial, asks) => {
  const turn = memory.subagents.get(agentId);
  if (turn === undefined || turn.serial !== serial)
    return;
  const row = { asks, carriedFrom: carriedFrom(turn.steps) };
  memory.subagents.set(agentId, { ...turn, appended: [...turn.appended, row] });
};
const subagentTurnStarted = (memory, agentId) => {
  const idle = memory.subagents.get(agentId);
  const turn = freshTurn(memory, agentId);
  if (idle === undefined || idle.steps > 0 || idle.appended.length === 0)
    return;
  const rows = idle.appended.map((row) => ({ ...row, carriedFrom: 1 }));
  memory.subagents.set(agentId, { ...turn, appended: rows });
};
const subagentStepped = (memory, agentId) => {
  const turn = turnOf(memory, agentId);
  const steps = turn.steps + 1;
  const carried = turn.appended.filter((row) => isCarried(row, steps));
  const waiting = turn.appended.filter((row) => !isCarried(row, steps));
  memory.subagents.set(agentId, { ...turn, steps, appended: waiting });
  if (carried.length > 0)
    queueReports(memory, merged(carried.flatMap((row) => row.asks)), "append");
};
const subagentTurnCompleted = (memory, agentId) => {
  memory.subagents.delete(agentId);
};

// packages/mod/src/turns.ts
const keepDropped = (memory, asks) => {
  memory.main = { ...memory.main, dropped: merged([...memory.main.dropped, ...asks]) };
};
const catchUp = (memory, $, epoch, asks) => {
  if (asks.length === 0)
    return;
  const keep = (kept) => keepDropped(memory, kept);
  submitPush(memory, $, epoch, asks, { dropped: keep, failed: keep });
};
const appended = (memory, $, epoch, asks) => {
  if (!memory.main.running) {
    catchUp(memory, $, epoch, asks);
    return;
  }
  const row = { asks, carriedFrom: carriedFrom(memory.main.steps) };
  memory.main = { ...memory.main, appended: [...memory.main.appended, row] };
};
const appendDropped = async (memory, $) => {
  const { dropped } = memory.main;
  const epoch = memory.session?.epoch;
  if (dropped.length === 0 || epoch === undefined)
    return;
  memory.main = { ...memory.main, dropped: [] };
  if (!await appendPush($, epoch, dropped)) {
    keepDropped(memory, dropped);
    return;
  }
  if (memory.session?.epoch !== epoch)
    return;
  appended(memory, $, epoch, dropped);
  queueReports(memory, dropped, "append");
};
const mainTurnStarted = async (memory, $) => {
  memory.main = { ...memory.main, running: true, steps: 0, appended: [] };
  await appendDropped(memory, $);
};
const mainTurnStepped = (memory) => {
  memory.main = { ...memory.main, steps: memory.main.steps + 1 };
};
const mainTurnCompleted = (memory, $) => {
  const { appended: rows, dropped, steps } = memory.main;
  memory.main = { ...memory.main, running: false, appended: [], dropped: [] };
  const epoch = memory.session?.epoch;
  if (epoch === undefined)
    return;
  const unread = rows.filter((row) => !isCarried(row, steps));
  catchUp(memory, $, epoch, merged([...dropped, ...unread.flatMap((row) => row.asks)]));
};
const appendToMain = async (memory, $, epoch, asks) => {
  markPushed(memory, asks);
  if (!await appendPush($, epoch, asks)) {
    unmarkPushed(memory, epoch, asks);
    return;
  }
  if (memory.session?.epoch !== epoch)
    return;
  appended(memory, $, epoch, asks);
  await reportDelivered(memory, $, epoch, asks, "append");
};

// packages/mod/src/push.ts
var FINISHED = new Set(["completed", "failed", "killed"]);
const newEventsByOwner = (memory, poll) => {
  const byOwner = new Map;
  for (const ask of poll.asks) {
    const events = ask.events.filter((event) => !memory.pushed.has(eventKey(ask.askId, event.cursor)));
    if (events.length === 0)
      continue;
    const entry = { askId: ask.askId, state: ask.state, cursor: ask.cursor, events };
    byOwner.set(ask.agent_id, [...byOwner.get(ask.agent_id) ?? [], entry]);
  }
  return byOwner;
};
const liveAgents = async ($) => {
  try {
    const agents = await $.agent.list();
    return agents.filter((agent) => !FINISHED.has(agent.status));
  } catch {
    debug($, "the agent list could not be read; no subagent is pushed to at this poll");
    return;
  }
};
const ownerOf = (agents, owner) => agents.find((agent) => agent.id === owner);
const byLiveAgent = (agents, owners) => {
  const byId = new Map;
  for (const [owner, asks] of owners) {
    const agent = ownerOf(agents, owner);
    if (agent === undefined)
      continue;
    byId.set(agent.id, { agent, asks: [...byId.get(agent.id)?.asks ?? [], ...asks] });
  }
  return [...byId.values()];
};
const isIdleTeammate = (agent) => agent.teammateId !== undefined && agent.status === "idle";
const pushToSubagent = async (memory, $, epoch, agentId, asks) => {
  const turn = subagentTurnAt(memory, agentId);
  markPushed(memory, asks);
  if (!await appendPush($, epoch, asks, agentId)) {
    unmarkPushed(memory, epoch, asks);
    return;
  }
  if (memory.session?.epoch === epoch)
    subagentAppended(memory, agentId, turn, asks);
};
const wakeTeammate = async (memory, $, epoch, agentId, asks) => {
  markPushed(memory, asks);
  if (await sendPush($, epoch, asks, agentId)) {
    if (memory.session?.epoch === epoch)
      await reportDelivered(memory, $, epoch, asks, "submit");
    return;
  }
  debugOnce(memory, $, "a message to an idle teammate was not delivered; its push is appended");
  await pushToSubagent(memory, $, epoch, agentId, asks);
};
const pushToMain = async (memory, $, epoch, asks) => {
  if (memory.main.running) {
    await appendToMain(memory, $, epoch, asks);
    return;
  }
  markPushed(memory, asks);
  submitPush(memory, $, epoch, asks, {
    dropped: (dropped) => keepDropped(memory, dropped),
    failed: (failed) => unmarkPushed(memory, epoch, failed)
  });
};
const pushPoll = async (memory, $, poll) => {
  const byOwner = newEventsByOwner(memory, poll);
  const main = byOwner.get(undefined);
  if (main !== undefined)
    await pushToMain(memory, $, poll.epoch, main);
  const subagents = [...byOwner].filter((owner) => owner[0] !== undefined);
  if (subagents.length === 0)
    return;
  const live = await liveAgents($);
  if (live === undefined)
    return;
  for (const { agent, asks } of byLiveAgent(live, subagents)) {
    if (isIdleTeammate(agent))
      await wakeTeammate(memory, $, poll.epoch, agent.id, asks);
    else
      await pushToSubagent(memory, $, poll.epoch, agent.id, asks);
  }
};

// packages/mod/src/teammates.ts
const nameOf = ({ name, teammateId = "" }) => {
  const at = teammateId.lastIndexOf("@");
  const fromAddress = (at < 0 ? teammateId : teammateId.slice(0, at)).trim();
  const given = name?.trim() || fromAddress;
  return Array.from(given).slice(0, TEAMMATE_NAME_MAX_CHARS).join("");
};
const lookUpTeammate = async (memory, $, agentId) => {
  if (memory.teammates.has(agentId))
    return;
  let agents;
  try {
    agents = await $.agent.list();
  } catch {
    debugOnce(memory, $, "the agent list could not be read; a turn report names no teammate");
    return;
  }
  const entry = agents.find((agent) => agent.id === agentId);
  if (entry === undefined)
    return;
  const name = entry.teammateId === undefined ? null : nameOf(entry);
  if (name !== "")
    memory.teammates.set(agentId, name);
};
const teammateNameOf = (memory, agentId) => {
  const name = memory.teammates.get(agentId);
  return typeof name === "string" ? name : undefined;
};

// packages/mod/src/turn-reports.ts
var ROUTE2 = LOCAL_API_ROUTES.modTurn.path;
var MAIN = "";
const bodyOf = (memory, agent, running) => {
  const teammate = agent === MAIN ? undefined : teammateNameOf(memory, agent);
  return {
    version: LOCAL_API_VERSION,
    ...agent === MAIN ? {} : { agent_id: agent },
    running,
    ...teammate === undefined ? {} : { teammate }
  };
};
const attempt = async (memory, $, agent, running) => {
  const session = memory.session;
  if (session === undefined)
    return false;
  const answer = await send(memory, $, session, {
    method: "POST",
    path: ROUTE2,
    body: bodyOf(memory, agent, running)
  });
  if (answer.kind === "refused")
    debug($, `POST ${ROUTE2} was refused with ${answer.status}`);
  return answer.kind === "refused" || answer.kind === "answered" && checks.ack(answer.body);
};
const queued = (memory, run) => {
  memory.turnReports = memory.turnReports.then(run, run);
  return memory.turnReports;
};
const turnChanged = (memory, $, agentId, running) => {
  const agent = agentId ?? MAIN;
  if (memory.turns.get(agent) === running)
    return;
  memory.turns.set(agent, running);
  memory.unsentTurns.delete(agent);
  const lookedUp = agent === MAIN ? undefined : lookUpTeammate(memory, $, agent);
  queued(memory, async () => {
    await lookedUp;
    if (memory.turns.get(agent) !== running)
      return;
    if (!await attempt(memory, $, agent, running))
      memory.unsentTurns.set(agent, running);
  });
};
const retryTurnReports = (memory, $) => queued(memory, async () => {
  const unsent = [...memory.unsentTurns];
  memory.unsentTurns.clear();
  for (const [agent, running] of unsent) {
    if (memory.turns.get(agent) === running)
      await attempt(memory, $, agent, running);
  }
});

// packages/mod/src/poll.ts
const start = async (memory, $) => {
  if (memory.starting || memory.location !== undefined)
    return;
  memory.starting = true;
  const location = await locate($);
  memory.starting = false;
  if (location === undefined) {
    debug($, "the Claude Code process could not be identified; push is off for this session");
    return;
  }
  memory.location = location;
  $.clock.every(POLL_INTERVAL_MS, () => tick(memory, $));
};
const sayHello = async (memory, $, session) => {
  if (memory.helloSaid)
    return;
  let version;
  try {
    ({ version } = await $.session.version());
  } catch {
    debugOnce(memory, $, "the Claude Code version could not be read; the hello waits a poll");
    return;
  }
  const answer = await send(memory, $, session, {
    method: "POST",
    path: LOCAL_API_ROUTES.modHello.path,
    body: { version: LOCAL_API_VERSION, client: { name: CLAUDE_CODE_CLIENT_NAME, version } }
  });
  if (answer.kind === "failed")
    return;
  memory.helloSaid = true;
  if (answer.kind === "refused") {
    debug($, `POST ${LOCAL_API_ROUTES.modHello.path} was refused with ${answer.status}`);
  }
};
const polled = async (memory, $, session) => {
  const route = LOCAL_API_ROUTES.poll.path;
  const answer = await send(memory, $, session, {
    method: "GET",
    path: pollPath(memory.continuation)
  });
  if (answer.kind === "refused") {
    debugOnce(memory, $, `GET ${route} was refused with ${answer.status}`);
  }
  if (answer.kind !== "answered")
    return;
  if (!checks.poll(answer.body)) {
    debugOnce(memory, $, `GET ${route} answered outside the local API's contract`);
    return;
  }
  const poll = answer.body;
  if (poll.epoch !== session.epoch)
    return;
  memory.continuation = poll.continuation;
  return poll;
};
var RECHECK_POLLS = 60000 / POLL_INTERVAL_MS;
const trusted = async (memory, $, location, session) => {
  const known = memory.session;
  const checked = memory.checkedAtPoll;
  const same = known?.pid === session.pid && known.epoch === session.epoch;
  if (same && checked !== undefined && memory.polls - checked < RECHECK_POLLS)
    return true;
  memory.checkedAtPoll = undefined;
  if (await isPrivate($, location)) {
    memory.checkedAtPoll = memory.polls;
    return true;
  }
  debugOnce(memory, $, "the session folder or file is not private to this user; push waits for one that is");
  return false;
};
const pollOnce = async (memory, $) => {
  const { location } = memory;
  if (location === undefined)
    return;
  const session = await readSession($, location);
  if (session === undefined || !await trusted(memory, $, location, session)) {
    clearPending(memory, $);
    return;
  }
  adopt(memory, session);
  await retryReports(memory, $, session.epoch);
  await retryTurnReports(memory, $);
  await sayHello(memory, $, session);
  const poll = await polled(memory, $, session);
  if (poll === undefined)
    return;
  await pushPoll(memory, $, poll);
  await showPending(memory, $, poll.pending);
};
const tick = async (memory, $) => {
  if (memory.polling)
    return;
  memory.polling = true;
  memory.polls += 1;
  try {
    await pollOnce(memory, $);
  } catch {
    debugOnce(memory, $, "a poll failed");
  } finally {
    memory.polling = false;
  }
};

// packages/mod/src/index.ts
function register(on) {
  const memory = createMemory();
  on("session.start", async ($, e, next) => {
    await start(memory, $);
    return next(e);
  });
  on("turn.start", async ($, e, next) => {
    turnChanged(memory, $, e.agentId, true);
    if (e.agentId === undefined)
      await mainTurnStarted(memory, $);
    else
      subagentTurnStarted(memory, e.agentId);
    return next(e);
  });
  on("turn.step", async function* (_$, e, next) {
    if (e.agentId === undefined)
      mainTurnStepped(memory);
    else
      subagentStepped(memory, e.agentId);
    return yield* next(e);
  });
  on("turn.complete", async ($, e, next) => {
    turnChanged(memory, $, e.agentId, false);
    if (e.agentId === undefined)
      mainTurnCompleted(memory, $);
    else
      subagentTurnCompleted(memory, e.agentId);
    return next(e);
  });
  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => drawBand(memory, $, e, next));
}
export {
  register
};
