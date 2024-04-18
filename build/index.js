"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const localhost = true;
const app = (0, express_1.default)();
const cors_options = {
    allowedHeaders: ['Content-Type', 'Accept', 'Content-Disposition', 'X-Filename'], // Add the custom headers here
    exposedHeaders: ['Content-Type', 'Accept', 'Content-Disposition', 'X-Filename'], // Add the custom headers here
};
app.use((0, cors_1.default)(cors_options));
app.use(express_1.default.json());
app.use(routes_1.default);
app.listen(localhost ? 3000 : 8080, () => {
    console.log('Server is running on port ' + (localhost ? "3000" : "8080"));
});
