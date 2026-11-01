const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
const { createInventoryRouter } = require("../src/routes/inventory");
const { HttpError } = require("../src/inventory/service");

