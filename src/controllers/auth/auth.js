import bcrypt from "bcryptjs";
import sendEmail from "../../utils/emailService.js";
import jsonResponse from "../../utils/jsonResponse.js";
import jwtSign from "../../utils/jwtSign.js";
import prisma from "../../utils/prismaClient.js";
import validateInput from "../../utils/validateInput.js";
import uploadToCLoudinary from "../../utils/uploadToCloudinary.js";


const module_name = "auth";


export const register = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // Check if user exists
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
        },
      });

      if (existingUser) {
        return res
          .status(409)
          .json(jsonResponse(false, "User already exists", null));
      }

      // Destructure body
      const {
        roleId,
        parentId,
        name,
        email,
        phone,
        presentAddress,
        permanentAddress,
        nidNo,
        password,
        otp,
        otpCount,
      } = req.body;

      // Validate required fields
      const inputValidation = validateInput(
        [name, email, phone, presentAddress, permanentAddress, nidNo, password],
        ["Name", "Email", "Phone", "Present Address", "Permanent Address", "NID No", "Password"]
      );
      if (inputValidation) {
        return res.status(400).json(jsonResponse(false, inputValidation, null));
      }

      // Prepare user data
      const userData = {
        roleId,
        parentId,
        name,
        email,
        phone,
        presentAddress,
        permanentAddress,
        nidNo,
        password,
        otp,
        otpCount,
        createdBy: req?.user?.id,
      };

      // ✅ Handle multiple NID attachment uploads
      if (req.files?.nidAttachment && req.files.nidAttachment.length > 0) {
        const nidUploadPromises = req.files.nidAttachment.map(
          (file) =>
            new Promise((resolve, reject) => {
              uploadToCLoudinary(file, "user_module", (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            })
        );

        const nidUploadResults = await Promise.all(nidUploadPromises);

        const nidUrls = nidUploadResults.map((result) => {
          if (!result?.secure_url) throw new Error("NID upload failed");
          return result.secure_url;
        });

        userData.nidAttachment = nidUrls;
      }

      // ✅ Handle Passport photo upload
      if (req.files?.passportPhoto && req.files.passportPhoto.length > 0) {
        const uploadResult = await new Promise((resolve, reject) => {
          uploadToCLoudinary(req.files.passportPhoto[0], "user_module", (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!uploadResult?.secure_url) {
          throw new Error("Passport photo upload failed");
        }
        userData.passportPhoto = uploadResult.secure_url;
      }

      // Create user
      const createUser = await tx.user.create({
        data: userData,
      });

      return res
        .status(200)
        .json(jsonResponse(true, "User has been created", createUser));
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

export const registerCustomer = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and Phone are required",
      });
    }

    return await prisma.$transaction(async (tx) => {

      // ✅ check existing customer
      const existingCustomer = await tx.customers.findFirst({
        where: { phone },
      });

      if (existingCustomer) {
        return res.status(409).json({
          success: false,
          message: "Customer already exists",
        });
      }

      // ✅ create customer (OTP fields included but empty)
      const newCustomer = await tx.customers.create({
        data: {
          name,
          phone,
          email: email ?? null,

          otp: null,
          otp_expiry: null,
          otp_count: 0,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: newCustomer,
      });
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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


export const sendLoginOtp = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {

      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
          isActive: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "You are not registered",
        });
      }

      if (req.body.type === "admin" && !user.roleId) {
        return res.status(401).json({
          success: false,
          message: "You are not permitted!",
        });
      }

      // 🔥 OTP generate
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // ⏱️ 2 MIN expiry
      const expiry = new Date(Date.now() + 2 * 60 * 1000);

      // 🔥 update OTP
      await tx.user.update({
        where: { id: user.id },
        data: {
          otp,
          otp_expiry: expiry,
          otpCount: { increment: 1 },
        },
      });

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "Email not found",
        });
      }

      // 📩 send email
      await sendEmail(
        user.email,
        "Login OTP",
        `<p>Your OTP is <b>${otp}</b><br/>It will expire in 2 minutes.</p>`
      );

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully (valid for 2 minutes)",
      });
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//login with otp

export const loginWithOtp = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {

      const user = await tx.user.findFirst({
        where: {
          OR: [{ email: req.body.email }, { phone: req.body.phone }],
          isDeleted: false,
          isActive: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "You are not registered",
        });
      }

      // ❌ OTP missing
      if (!user.otp) {
        return res.status(400).json({
          success: false,
          message: "OTP not generated",
        });
      }

      // ⏱️ EXPIRE CHECK (2 min)
      if (!user.otp_expiry || new Date() > new Date(user.otp_expiry)) {
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please request again.",
        });
      }

      // ❌ WRONG OTP
      if (user.otp !== req.body.otp.toString()) {
        return res.status(400).json({
          success: false,
          message: "Wrong OTP",
        });
      }

      // ✅ clear OTP after success
      await tx.user.update({
        where: { id: user.id },
        data: {
          otp: null,
          otp_expiry: null,
        },
      });

      // =========================
      // TOKEN (same logic as yours)
      // =========================

      let roleModuleList = user?.roleId
        ? await tx.roleModule.findMany({
            where: { roleId: user.roleId, isDeleted: false },
            include: { module: true },
          })
        : [];

      const module_names = roleModuleList.map(r => r?.module?.name);

      const roleName = user?.roleId
        ? await tx.role.findFirst({
            where: { id: user.roleId, isDeleted: false },
          })
        : { name: "customer" };

      const token = jwtSign({
        id: user.id,
        phone: user.phone,
        email: user.email,
        roleId: user.roleId,
        roleName: roleName.name,
        moduleNames: module_names,
      });

      const { password, otp, otpCount, otp_expiry, ...others } = user;

      return res
        .cookie("accessToken", token, { httpOnly: true })
        .status(200)
        .json({
          success: true,
          message: "Logged In",
          data: {
            ...others,
            accessToken: token,
          },
        });

    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
