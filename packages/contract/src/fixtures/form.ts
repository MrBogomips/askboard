// The Form's fixtures (form-widget, design decision 8): `FORM_TYPES`, the entries a test gives the
// shipped registry through `withWidgetTypes` while the PickField is not registered, a question
// built as a Form (a Group per section in a Tabs, one field of each type, required and patterned
// fields) and an answer's results for it. Tests only; no shipped unit imports them. Item IDs here
// are used by no other fixture.

import { PICK_FIELD_WIDGET } from "../widgets/pick-field/widget.ts";
import type { WidgetType } from "../widgets/registry.ts";

/**
 * The Form's added entry. A test passes it to `withWidgetTypes(...FORM_TYPES)`; the same test
 * passes before and after the PickField joins `WIDGET_TYPES`.
 */
export const FORM_TYPES: readonly WidgetType[] = [PICK_FIELD_WIDGET];

/**
 * A question that is a Form: a Tabs of two tabs, each holding a Group, "Contact" with a required
 * TextField, a TextField with a pattern and a required DateField, and "Preferences" with a
 * NumberField, a MoneyField, a single and a multiple PickField and a Toggle.
 */
export const FORM_QUESTION = {
  type: "question",
  id: "form-intake",
  props: {
    text: "Please fill in the intake form.",
    items: [
      {
        type: "tabs",
        id: "form-tabs",
        props: {
          tabs: [
            {
              id: "form-contact-tab",
              title: "Contact",
              items: [
                {
                  type: "group",
                  id: "form-contact",
                  props: {
                    title: "Contact",
                    items: [
                      {
                        type: "text-field",
                        id: "form-name",
                        props: { label: "Name", required: true, minLength: 2, maxLength: 80 },
                      },
                      {
                        type: "text-field",
                        id: "form-ticket",
                        props: {
                          label: "Ticket",
                          description: "Two capitals, a dash and four digits.",
                          pattern: "^[A-Z]{2}-\\d{4}$",
                        },
                      },
                      {
                        type: "date-field",
                        id: "form-start",
                        props: { label: "Start date", required: true, min: "2026-01-01" },
                      },
                    ],
                  },
                },
              ],
            },
            {
              id: "form-prefs-tab",
              title: "Preferences",
              items: [
                {
                  type: "group",
                  id: "form-prefs",
                  props: {
                    title: "Preferences",
                    items: [
                      {
                        type: "number-field",
                        id: "form-seats",
                        props: { label: "Seats", min: 1, max: 20, integer: true, required: true },
                      },
                      {
                        type: "money-field",
                        id: "form-budget",
                        props: { label: "Budget", currency: "EUR", min: "0" },
                      },
                      {
                        type: "pick-field",
                        id: "form-region",
                        props: {
                          label: "Region",
                          required: true,
                          options: [
                            { id: "eu", label: "Europe" },
                            { id: "us", label: "North America" },
                            { id: "apac", label: "Asia-Pacific", description: "Includes Oceania." },
                          ],
                        },
                      },
                      {
                        type: "pick-field",
                        id: "form-channels",
                        props: {
                          label: "Channels",
                          multiple: true,
                          minItems: 1,
                          maxItems: 2,
                          options: [
                            { id: "email", label: "Email" },
                            { id: "chat", label: "Chat" },
                            { id: "phone", label: "Phone" },
                          ],
                        },
                      },
                      { type: "toggle", id: "form-notify", props: { label: "Notify me" } },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  },
} as const;

/** The results of an answer to `FORM_QUESTION`, each field's value by its item ID. */
export const FORM_RESULTS = {
  "form-name": "Ada Lovelace",
  "form-ticket": "AB-1234",
  "form-start": "2026-03-02",
  "form-seats": 4,
  "form-budget": { amount: "1200", currency: "EUR" },
  "form-region": "eu",
  "form-channels": ["email", "chat"],
  "form-notify": true,
} as const;
