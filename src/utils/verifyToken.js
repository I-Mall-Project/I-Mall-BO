import jwt from "jsonwebtoken";
import jsonResponse from "./jsonResponse.js";
import prisma from "./prismaClient.js";

const verify = async (req, res, next) => {
  try {
    const cookiesToken = req.cookies?.token;
    const authHeader = req.headers.authorization;

    const token = authHeader
      ? authHeader.split(" ")[1]
      : cookiesToken;

    if (!token) {
      return res
        .clearCookie("token", { secure: true, sameSite: "none" })
        .status(401)
        .json(jsonResponse(false, "You are not authenticated!", null));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // =========================
    // ✅ CUSTOMER
    // =========================
    if (decoded.type === "customer") {
      const customer = await prisma.customers.findFirst({
        where: { id: decoded.id },
      });

      if (!customer) {
        return res
          .clearCookie("token", { secure: true, sameSite: "none" })
          .status(401)
          .json(jsonResponse(false, "Customer not found", null));
      }

      req.user = {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        type: "customer",
      };
    }

    // =========================
    // ✅ ADMIN
    // =========================
    else if (decoded.type === "admin") {
      const activeUser = await prisma.user.findFirst({
        where: { id: decoded.id, isDeleted: false },
      });

      if (!activeUser) {
        return res
          .clearCookie("token", { secure: true, sameSite: "none" })
          .status(401)
          .json(jsonResponse(false, "Please login again", null));
      }

      req.user = { ...decoded, type: "admin" };
    }

    // =========================
    // ❌ INVALID TOKEN
    // =========================
    else {
      return res
        .status(401)
        .json(jsonResponse(false, "Invalid token type", null));
    }

    next();
  } catch (err) {
    console.log("JWT ERROR:", err.message);

    return res
      .status(401)
      .json(jsonResponse(false, "Please login again", null));
  }
};

export default verify;