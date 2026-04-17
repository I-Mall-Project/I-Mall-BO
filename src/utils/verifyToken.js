import jwt from "jsonwebtoken";
import arrayEquals from "./arrayEquals.js";
import jsonResponse from "./jsonResponse.js";
import prisma from "./prismaClient.js";

const verify = (req, res, next) => {
  const cookiesToken = req.cookies.accessToken;

  // ✅ FIX: support BOTH header
  const authHeader =
    req.headers.authorization || req.headers.token;

  const token = authHeader
    ? authHeader.split(" ")[1]
    : cookiesToken;

  if (!token) {
    return res
      .clearCookie("accessToken", { secure: true, sameSite: "none" })
      .status(401)
      .json(jsonResponse(false, "You are not authenticated!", null));
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err || !decoded) {
      return res
        .status(403)
        .json(jsonResponse(false, "Token is not valid!", null));
    }

    try {
      req.user = decoded;

      // =========================
      // ✅ ADMIN
      // =========================
      if (decoded.id) {
        const activeUser = await prisma.user.findFirst({
          where: { id: decoded.id, isDeleted: false },
        });

        if (!activeUser) {
          return res.status(401).json(
            jsonResponse(false, "Please login again", null)
          );
        }

        req.user.type = "admin";
      }

      // =========================
      // ✅ CUSTOMER
      // =========================
      else if (decoded.phone) {
        const customer = await prisma.customers.findFirst({
          where: { phone: decoded.phone },
        });

        if (!customer) {
          return res.status(401).json(
            jsonResponse(false, "Customer not found", null)
          );
        }

        req.user = {
          id: customer.id,
          phone: customer.phone,
          name: customer.name,
          type: "customer",
        };
      }

      else {
        return res
          .status(401)
          .json(jsonResponse(false, "Invalid token payload", null));
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json(jsonResponse(false, "Server error", null));
    }
  });
};

export default verify;