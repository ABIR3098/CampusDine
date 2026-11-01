const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const rules = require("../inventory/rules");
const { HttpError } = require("../inventory/service");

