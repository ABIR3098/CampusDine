// Pure rules for the kitchen inventory feature (no database access, so they are easy to unit test).

const UNITS = ["kg", "g", "litre", "ml", "piece", "dozen", "packet", "bottle"];
const REQUEST_TYPES = ["report", "request"];
const REQUEST_STATUSES = ["pending", "approved", "rejected", "purchased"];
const MAX_QTY = 10000000;

// pending -> approved | rejected, approved -> purchased. rejected and purchased are final.
const TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["purchased"],
  rejected: [],
  purchased: [],
};

