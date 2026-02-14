import express from "express";
import {
  banUser,
  deleteUser,
  getUser,
  getUsers,
  getUsersByUser,
  updateUser,
} from "../../controllers/auth/user.js";
import {
  usersBan,
  usersEdit,
  usersList,
  usersRemove,
  usersSingle,
  usersUserList,
} from "../../utils/modules.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

router.get("/v1/auth/users", usersList, verify, getUsers);
router.get("/v1/auth/user/users", usersUserList, verify, getUsersByUser);
router.get("/v1/auth/users/:id", usersSingle, verify, getUser);
router.put("/v1/auth/users/:id", usersEdit, verify, updateUser);
router.put("/v1/users/:id/ban", usersBan, verify, banUser);
router.delete("/v1/auth/users/:id", usersRemove, verify, deleteUser);

//For customer
router.get("/v1/customer/auth/users/:id", verify, getUser);
router.put("/v1/customer/auth/users/:id", verify, updateUser);

export default router;
