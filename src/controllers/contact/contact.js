import { defaultLimit, defaultPage } from "../../utils/defaultData.js";
import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import validateInput from "../../utils/validateInput.js";
// import uploadImage from "../../utils/uploadImage.js";

const module_name = "contact";

//create contact
export const createContact = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const {
        name,
        email,
        message,
        mobileNumber,   // optional
        fullAddress,    // optional
        connectionType, // optional
        packageChoice,  // optional
      } = req.body;

      // Validate required input
      const inputValidation = validateInput(
        [name, email, message],
        ["Name", "Email", "Message"]
      );

      if (inputValidation) {
        return res
          .status(400)
          .json(jsonResponse(false, inputValidation, null));
      }

      // Create contact
      const newContact = await tx.contact.create({
        data: {
          name,
          email,
          message,
          mobileNumber: mobileNumber || null,
          fullAddress: fullAddress || null,
          connectionType: connectionType || null,
          packageChoice: packageChoice || null,
        },
      });

      return res
        .status(200)
        .json(jsonResponse(true, "Message has been sent.", newContact));
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


//get all newsletters
export const getContacts = async (req, res) => {
  //   if (req.user.roleName !== "super-admin") {
  //     getCategoriesByUser(req, res);
  //   } else {
  try {
    const newsletters = await prisma.contact.findMany({
      where: {
        AND: [
          {
            email: {
              contains: req.query.email,
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: req.query.name,
              mode: "insensitive",
            },
          },
        ],
      },
      //   include: {
      //     serviceItem: true,
      //     serviceManufacturer: true,
      //     serviceModel: true,
      //   },
      orderBy: {
        createdAt: "desc",
      },
      skip:
        req.query.limit && req.query.page
          ? parseInt(req.query.limit * (req.query.page - 1))
          : parseInt(defaultLimit() * (defaultPage() - 1)),
      take: req.query.limit
        ? parseInt(req.query.limit)
        : parseInt(defaultLimit()),
    });

    if (newsletters.length === 0)
      return res
        .status(200)
        .json(jsonResponse(true, "No message is available", null));

    if (newsletters) {
      return res
        .status(200)
        .json(
          jsonResponse(
            true,
            `${newsletters.length} messages found`,
            newsletters
          )
        );
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "Something went wrong. Try again", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
  //   }
};

//get all manufacturers by user
// export const getManufacturersByUser = async (req, res) => {
//   try {
//     const categories = await prisma.category.findMany({
//       where: {
//         userId: req.user.parentId ? req.user.parentId : req.user.id,
//         isDeleted: false,
//         AND: [
//           {
//             name: {
//               contains: req.query.name,
//               mode: "insensitive",
//             },
//           },
//         ],
//       },
//       include: { user: true },
//       orderBy: {
//         createdAt: "desc",
//       },
//       skip:
//         req.query.limit && req.query.page
//           ? parseInt(req.query.limit * (req.query.page - 1))
//           : parseInt(defaultLimit() * (defaultPage() - 1)),
//       take: req.query.limit
//         ? parseInt(req.query.limit)
//         : parseInt(defaultLimit()),
//     });

//     if (categories.length === 0)
//       return res
//         .status(200)
//         .json(jsonResponse(true, "No category is available", null));

//     if (categories) {
//       return res
//         .status(200)
//         .json(
//           jsonResponse(
//             true,
//             `${categories.length} categories found`,
//             categories
//           )
//         );
//     } else {
//       return res
//         .status(404)
//         .json(jsonResponse(false, "Something went wrong. Try again", null));
//     }
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };

//get single newsletter
export const getContact = async (req, res) => {
  try {
    const newsletter = await prisma.contact.findFirst({
      //   where: { slug: req.params.slug },
      where: { id: req.params.id },
      //   include: {
      //     serviceItem: true,
      //     serviceManufacturer: true,
      //     serviceModel: true,
      //   },
    });

    if (newsletter) {
      return res
        .status(200)
        .json(jsonResponse(true, `1 contact found`, newsletter));
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "No contact is available", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//update newsletter
export const updateContact = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      let { email, name, subject, message, isActive } = req.body;

      //validate input
      const inputValidation = validateInput(
        [email, name, subject, message],
        ["Email", "Name", "Subject", "Message"]
      );

      if (inputValidation) {
        return res.status(400).json(jsonResponse(false, inputValidation, null));
      }

      //   if (serviceManufacturerId) {
      //     if (
      //       serviceManufacturerId.trim() === "" ||
      //       serviceManufacturerId === "null"
      //     ) {
      //       serviceManufacturerId = undefined;
      //     }
      //   } else {
      //     serviceManufacturerId = undefined;
      //   }

      //   if (serviceModelId) {
      //     if (serviceModelId.trim() === "" || serviceModelId === "null") {
      //       serviceModelId = undefined;
      //     }
      //   } else {
      //     serviceModelId = undefined;
      //   }

      //get user id from brand and user name from user for slugify
      const findNewsletter = await tx.contact.findFirst({
        where: { id: req.params.id },
      });

      if (!findNewsletter)
        return res
          .status(404)
          .json(jsonResponse(false, "This contact does not exist", null));

      //   const user = await tx.user.findFirst({
      //     where: { id: findCategory.userId },
      //   });

      //   if (!user)
      //     return res
      //       .status(404)
      //       .json(jsonResponse(false, "This user does not exist", null));

      //check if slug already exists
      //   if (email) {
      //     if (
      //       email?.toLowerCase()?.trim() !==
      //       findNewsletter?.email?.toLowerCase()?.trim()
      //     ) {
      //       const existingNewsletter = await tx.newsletter.findFirst({
      //         where: {
      //           id: req.params.id,
      //         },
      //       });

      //       //   if (existingBanner && existingBanner.slug === `${slugify(name)}`) {
      //       if (
      //         existingNewsletter &&
      //         existingNewsletter.email?.toLowerCase()?.trim() ===
      //           email?.toLowerCase()?.trim()
      //       ) {
      //         return res
      //           .status(409)
      //           .json(
      //             jsonResponse(false, `${email} already exists. Change it.`, null)
      //           );
      //       }
      //     }
      //   }

      //upload image
      // let imageUpload;
      //   if (req.file) {
      //     // imageUpload = await uploadImage(req.file);
      //     await uploadToCLoudinary(
      //       req.file,
      //       module_name,
      //       async (error, result) => {
      //         if (error) {
      //           console.error("error", error);
      //           return res.status(404).json(jsonResponse(false, error, null));
      //         }

      //         if (!result.secure_url) {
      //           return res
      //             .status(404)
      //             .json(
      //               jsonResponse(
      //                 false,
      //                 "Something went wrong while uploading image. Try again",
      //                 null
      //               )
      //             );
      //         }

      //         //update banner
      //         const banner = await prisma.banner.update({
      //           where: { id: req.params.id },
      //           data: {
      //             title,
      //             subtitle,
      //             isActive: isActive === "true" ? true : false,
      //             image: result.secure_url,
      //             // slug: name ? `${slugify(name)}` : findBrand.slug,
      //           },
      //         });

      //         //delete previous uploaded image
      //         await deleteFromCloudinary(
      //           findBanner.image,
      //           async (error, result) => {
      //             console.log("error", error);
      //             console.log("result", result);
      //           }
      //         );

      //         if (banner) {
      //           return res
      //             .status(200)
      //             .json(jsonResponse(true, `Banner has been updated`, banner));
      //         } else {
      //           return res
      //             .status(404)
      //             .json(jsonResponse(false, "Banner has not been updated", null));
      //         }
      //       }
      //     );

      //     // fs.unlinkSync(
      //     //   `public\\images\\${module_name}\\${findCategory.image.split("/")[2]}`
      //     // );
      //   }
      //   else {
      //if there is no image selected
      //update category
      const newsletter = await prisma.contact.update({
        where: { id: req.params.id },
        data: {
          name,
          email,
          subject,
          message,
          //   isActive: isActive === "true" ? true : false,
          // image: findBanner.image,
          // slug: name ? `${slugify(name)}` : findBrand.slug,
        },
      });

      if (newsletter) {
        return res
          .status(200)
          .json(
            jsonResponse(true, `Contact message has been updated`, newsletter)
          );
      } else {
        return res
          .status(404)
          .json(
            jsonResponse(false, "Contact message has not been updated", null)
          );
      }
      //   }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//ban category
// export const banCategory = async (req, res) => {
//   try {
//     return await prisma.$transaction(async (tx) => {
//       //ban category
//       const getCategory = await tx.category.findFirst({
//         where: { id: req.params.id },
//       });

//       const category = await tx.category.update({
//         where: { id: req.params.id },
//         data: {
//           isActive: getCategory.isActive === true ? false : true,
//         },
//       });

//       if (category) {
//         return res
//           .status(200)
//           .json(jsonResponse(true, `Category has been banned`, category));
//       } else {
//         return res
//           .status(404)
//           .json(jsonResponse(false, "Category has not been banned", null));
//       }
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };

//delete newsletter
export const deleteContact = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const newsletter = await tx.contact.delete({
        where: { id: req.params.id },
      });

      if (newsletter) {
        // fs.unlinkSync(
        //   `public\\images\\${module_name}\\${category.image.split("/")[2]}`
        // );
        // await deleteFromCloudinary(banner.image, async (error, result) => {
        //   console.log("error", error);
        //   console.log("result", result);
        // });

        return res
          .status(200)
          .json(
            jsonResponse(true, `Contact message has been deleted`, newsletter)
          );
      } else {
        return res
          .status(404)
          .json(
            jsonResponse(false, "Contact message has not been deleted", null)
          );
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//For Customer

//get all coupons for customer
// export const getCouponsForCustomer = async (req, res) => {
//   try {
//     const coupons = await prisma.coupon.findMany({
//       where: {
//         isActive: true,
//         AND: [
//           {
//             code: {
//               contains: req.query.code,
//               mode: "insensitive",
//             },
//           },
//         ],
//       },
//       //   include: {
//       //     serviceItem: true,
//       //     serviceManufacturer: true,
//       //     serviceModel: true,
//       //   },
//       //   select: {
//       //     user: { select: { name: true, image: true } },
//       //     id: true,
//       //     name: true,
//       //     image: true,
//       //     slug: true,
//       //     createdAt: true,
//       //   },
//       orderBy: {
//         createdAt: "desc",
//       },
//       skip:
//         req.query.limit && req.query.page
//           ? parseInt(req.query.limit * (req.query.page - 1))
//           : parseInt(defaultLimit() * (defaultPage() - 1)),
//       take: req.query.limit
//         ? parseInt(req.query.limit)
//         : parseInt(defaultLimit()),
//     });

//     if (coupons.length === 0)
//       return res
//         .status(200)
//         .json(jsonResponse(true, "No coupon is available", null));

//     if (coupons) {
//       return res
//         .status(200)
//         .json(jsonResponse(true, `${coupons.length} coupons found`, coupons));
//     } else {
//       return res
//         .status(404)
//         .json(jsonResponse(false, "Something went wrong. Try again", null));
//     }
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };

//get single coupon for customer
// export const getCouponForCustomer = async (req, res) => {
//   try {
//     const coupon = await prisma.coupon.findFirst({
//       where: {
//         // slug: req.params.slug,
//         code: req.params.id,
//         isActive: true,
//       },
//       //   include: {
//       //     serviceItem: true,
//       //     serviceManufacturer: true,
//       //     serviceModel: true,
//       //   },
//       //   select: {
//       //     user: { select: { name: true, image: true } },
//       //     id: true,
//       //     name: true,
//       //     image: true,
//       //     slug: true,
//       //     createdAt: true,
//       //   },
//     });

//     if (coupon) {
//       return res
//         .status(200)
//         .json(jsonResponse(true, `Coupon is added`, coupon));
//     } else {
//       return res
//         .status(404)
//         .json(jsonResponse(false, "No coupon is available", null));
//     }
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };
