import bcrypt from "bcryptjs";
import sendEmail from "../../utils/emailService.js";
import jsonResponse from "../../utils/jsonResponse.js";
import jwtSign from "../../utils/jwtSign.js";
import prisma from "../../utils/prismaClient.js";
import validateInput from "../../utils/validateInput.js";

const module_name = "auth";

//register
export const register = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      //Check user if exists
      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
        },
      });

      if (user) {
        return res
          .status(409)
          .json(jsonResponse(false, "User already exists", null));
      }

      //Create a new user and Hash the password
      // const hashedPassword = hashPassword(req.body.password);

      const {
        roleId,
        parentId,
        name,
        email,
        phone,
        address,
        billingAddress,
        country,
        city,
        postalCode,
        image,
        // password,
        otp,
        otpCount,
        initialPaymentAmount,
        initialPaymentDue,
        installmentTime,
      } = req.body;

      console.log(req.body);

      //validate input
      const inputValidation = validateInput(
        [name, email, phone, address, billingAddress, country, city],
        [
          "Name",
          "Email",
          "Phone",
          "Shipping Address",
          "Billing Address",
          "Country",
          "City",
        ]
      );

      if (inputValidation) {
        return res.status(400).json(jsonResponse(false, inputValidation, null));
      }

      //create user
      const createUser = await tx.user.create({
        data: {
          roleId,
          parentId,
          name,
          email,
          phone,
          address,
          billingAddress,
          country,
          city,
          postalCode,
          image: "https://cdn-icons-png.flaticon.com/512/9368/9368192.png",
          // password: hashedPassword,
          otp,
          otpCount,
          initialPaymentAmount,
          initialPaymentDue,
          installmentTime,
          createdBy: req?.user?.id,
        },
      });

      console.log({ createUser });

      if (createUser) {
        return res
          .status(200)
          .json(jsonResponse(true, "User has been created", createUser));
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//login with password (plain text)
export const login = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      //login with phone or email
      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
        },
      });

      if (!user)
        return res
          .status(404)
          .json(jsonResponse(false, "Wrong credentials", null));

      if (user.isActive === false) {
        return res
          .status(401)
          .json(jsonResponse(false, "You are not authenticated!", null));
      }

      //match password (plain text)
      if (req.body.password !== user.password)
        return res
          .status(404)
          .json(jsonResponse(false, "Wrong password", null));

      //get modules for logged in user
      const roleModuleList = await tx.roleModule.findMany({
        where: { roleId: user.roleId ?? undefined, isDeleted: false },
        include: { module: true },
      });

      const module_names = roleModuleList.map((rm) => rm.module.name);

      const roleName = await tx.role.findFirst({
        where: { id: user.roleId, isDeleted: false },
      });

      const token = jwtSign({
        id: user.id,
        parentId: user.parentId ? user.parentId : user.id,
        phone: user.phone,
        email: user.email,
        roleId: user.roleId,
        roleName: roleName.name,
        isActive: user.isActive,
        moduleNames: module_names,
      });

      const { password, otp, otpCount, ...others } = user;

      res
        .cookie("accessToken", token, {
          httpOnly: true,
        })
        .status(200)
        .json(
          jsonResponse(true, "Logged In", { ...others, accessToken: token })
        );
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


//send login otp to mail
export const sendLoginOtp = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      //login with phone or email
      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
          isActive: true,
        },
      });

      if (!user)
        return res
          .status(404)
          .json(jsonResponse(false, "You are not registered", null));

      if (user.isActive === false) {
        return res
          .status(401)
          .json(jsonResponse(false, "You are not authenticated!", null));
      }

      if (req.body.type === "admin" && user?.roleId === null) {
        return res
          .status(401)
          .json(jsonResponse(false, "You are not permitted!", null));
      }

      //update user otp
      const sixDigitOtp = Math.floor(100000 + Math.random() * 900000);
      let updateOtp;

      if (!user?.otp) {
        updateOtp = await prisma.user.update({
          where: { id: user.id },
          data: {
            otp: sixDigitOtp,
            otpCount: user.otpCount + 1,
          },
        });

        if (!updateOtp)
          return res
            .status(404)
            .json(
              jsonResponse(false, "Something went wrong. Try again.", null)
            );
      }

      // console.log(user.email);

      if (!user.email || user.email.trim() === "") {
        res
          .status(400)
          .json(jsonResponse(false, "Email is not registered", null));
      }

      // await sendEmail(
      //   "user.email@email.com",
      //   "Ecommerce OTP",
      //   `<p>Your otp is ${updateOtp?.otp}</p>`
      // );

      // if (!updateOtp?.otp) {
      const emailGenerate = await sendEmail(
        updateOtp?.email ?? user.email,
        "Strike Shoes OTP",
        `<p>Your otp is ${updateOtp?.otp ?? user?.otp}</p>`
      );
      // }

      await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
          isActive: true,
        },
      });

      // console.log({ emailGenerate });

      // if (emailGenerate) {
      res
        .status(200)
        .json(jsonResponse(true, "Otp is sent to your mail", null));
      // }

      // if (user.email && user.email.trim() !== "") {
      //   const promise1 = new Promise((resolve, reject) => {
      //     resolve(
      //       sendEmail(
      //         user.email,
      //         "Ecommerce OTP",
      //         `<p>Your otp is ${sixDigitOtp}</p>`
      //       )
      //     );
      //   });
      //   // const send_email = sendEmail(
      //   //   user.email,
      //   //   "Ecommerce OTP",
      //   //   `<p>Your otp is ${sixDigitOtp}</p>`
      //   // );

      //   promise1
      //     .then(() => {
      //       res
      //         .status(200)
      //         .json(jsonResponse(true, "Otp is sent to your mail", null));
      //     })
      //     .catch((error) => {
      //       console.log(error);
      //     });
      // }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//login with otp
export const loginWithOtp = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      //login with otp
      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
          isActive: true,
        },
      });

      if (!user)
        return res
          .status(404)
          .json(jsonResponse(false, "You are not registered", null));

      if (user.isActive === false) {
        return res
          .status(401)
          .json(jsonResponse(false, "You are not authenticated!", null));
      }

      //match user otp and login
      if (user.otp !== null && user.otp !== "") {
        if (user.otp === req.body.otp) {
          const updateOtp = await prisma.user.update({
            where: { id: user.id },
            data: {
              otp: null,
            },
          });

          if (!updateOtp)
            return res
              .status(500)
              .json(
                jsonResponse(false, "Something went wrong. Try again.", null)
              );

          //get modules for logged in user
          let roleModuleList = [];
          roleModuleList = user?.roleId
            ? await tx.roleModule.findMany({
                where: { roleId: user.roleId, isDeleted: false },
                include: { module: true },
              })
            : [];

          const roleModuleList_length = roleModuleList.length;

          const roleName = user?.roleId
            ? await tx.role.findFirst({
                where: { id: user.roleId, isDeleted: false },
              })
            : { name: "customer" };

          const module_names = [];

          for (let i = 0; i < roleModuleList_length; i++) {
            module_names.push(roleModuleList[i]?.module?.name);
          }

          const token = jwtSign({
            id: user.id,
            parentId: user.parentId ? user.parentId : user.id,
            phone: user.phone,
            email: user.email,
            roleId: user.roleId,
            roleName: roleName.name,
            isActive: user.isActive,
            moduleNames: module_names,
          });

          const { password, otp, otpCount, ...others } = user;

          res
            .cookie("accessToken", token, {
              httpOnly: true,
            })
            .status(200)
            .json(
              jsonResponse(true, "Logged In", { ...others, accessToken: token })
            );
        } else {
          return res.status(400).json(jsonResponse(false, "Wrong OTP", null));
        }
      } else {
        return res
          .status(400)
          .json(jsonResponse(false, "You didn't receive any OTP yet", null));
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//logout
export const logout = (req, res) => {
  res
    .clearCookie("accessToken", {
      secure: true,
      sameSite: "none",
    })
    .status(200)
    .json(jsonResponse(true, "Logged out", null));
};
