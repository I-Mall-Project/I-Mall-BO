import jwt from "jsonwebtoken";
import arrayEquals from "./arrayEquals.js";
import jsonResponse from "./jsonResponse.js";
import prisma from "./prismaClient.js";

const verify = (req, res, next) => {
  const cookiesToken = req.cookies.accessToken;
  const authHeader = req.headers.token;

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
      // ✅ CASE 1: ADMIN / USER
      // =========================
      if (decoded.id) {
        const activeUser = await prisma.user.findFirst({
          where: { id: decoded.id, isDeleted: false },
          select: {
            id: true,
            roleId: true,
            parentId: true,
            isActive: true,
            isDeleted: true,
          },
        });

        if (!activeUser) {
          return res
            .clearCookie("accessToken", { secure: true, sameSite: "none" })
            .status(401)
            .json(
              jsonResponse(false, "You are not authenticated. Please login again", null)
            );
        }

        // role / parent check
        if (activeUser.roleId !== null) {
          if (
            activeUser.roleId !== req.user.roleId ||
            (activeUser.parentId
              ? activeUser.parentId !== req.user.parentId
              : false)
          ) {
            return res
              .clearCookie("accessToken", { secure: true, sameSite: "none" })
              .status(401)
              .json(jsonResponse(false, "Please log in again!", null));
          }
        }

        // module access check
        const roleModuleList = await prisma.roleModule.findMany({
          where: { roleId: activeUser.roleId ?? undefined, isDeleted: false },
          include: { module: true },
        });

        const module_names = roleModuleList.map((r) => r.module.name);

        if (activeUser.roleId !== null) {
          if (!arrayEquals(req.user.moduleNames, module_names)) {
            return res
              .clearCookie("accessToken", { secure: true, sameSite: "none" })
              .status(401)
              .json(jsonResponse(false, "Please log in again!", null));
          }
        }

        if (!activeUser.isActive) {
          return res
            .clearCookie("accessToken", { secure: true, sameSite: "none" })
            .status(401)
            .json(
              jsonResponse(false, "You are no longer authenticated user!", null)
            );
        }

        // module permission
        if (res.locals.module_name) {
          if (
            req.user &&
            req.user.moduleNames.includes(res.locals.module_name) === false
          ) {
            return res.status(409).json({
              success: false,
              message: "You do not have permission to access this module",
              data: null,
            });
          }
        }

        req.user.type = "admin"; // 🔥 important
      }

      // =========================
      // ✅ CASE 2: CUSTOMER
      // =========================
      else if (decoded.phone) {
        const customer = await prisma.customers.findFirst({
          where: { phone: decoded.phone },
        });

        if (!customer) {
          return res
            .clearCookie("accessToken", { secure: true, sameSite: "none" })
            .status(401)
            .json(jsonResponse(false, "Customer not found", null));
        }

        // 🔥 attach customer info
        req.user.id = customer.id;
        req.user.phone = customer.phone;
        req.user.name = customer.name;
        req.user.type = "customer";
      }

      // =========================
      // ❌ INVALID TOKEN STRUCTURE
      // =========================
      else {
        return res
          .status(401)
          .json(jsonResponse(false, "Invalid token payload", null));
      }

      next();
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json(jsonResponse(false, "Server error", null));
    }
  });
};

export default verify;