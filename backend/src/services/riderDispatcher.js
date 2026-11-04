const pool = require("../db");
const { createRiderDispatcher } = require("./riderDispatch");

// The one dispatcher the whole server uses, so "one run at a time" holds across routes and the timer.
module.exports = createRiderDispatcher({ pool });
