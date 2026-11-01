const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
const { createInventoryRouter } = require("../src/routes/inventory");
const { HttpError } = require("../src/inventory/service");

const calls = [];
const record = (name) => async (...args) => { calls.push([name, ...args]); return stub[name + "Result"] ?? {}; };
const stub = {
  listItems: async () => [{ id: 1, name: "Rice", unit: "kg", currentStock: 100, minStock: 10, level: "ok" }],
  createRequest: async (staffId, v) => { calls.push(["createRequest", staffId, v]); return { id: 7, staffId, itemName: "Rice", status: "pending" }; },
  listStaffRequests: async (id) => { calls.push(["listStaffRequests", id]); return []; },
  listAllRequests: record("listAllRequests"),
