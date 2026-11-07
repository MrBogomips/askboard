// How a request's wording reads an Approval's props (approval-scale-ranking, design decision 1): the
// expected shape and the field list of its one object, keyed `approval.props`. Nothing here
// validates.

export const APPROVAL_EXPECTED: Readonly<Record<string, string>> = {
  "approval.props": "an Approval's props, an empty object {}",
};

export const APPROVAL_FIELDS: Readonly<Record<string, string>> = {
  "approval.props": "an Approval's props hold no field: use {}",
};
