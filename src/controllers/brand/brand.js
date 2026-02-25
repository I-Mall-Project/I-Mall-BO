import { defaultLimit, defaultPage } from "../../utils/defaultData.js";
import deleteFromCloudinary from "../../utils/deleteFromCloudinary.js";
import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import slugify from "../../utils/slugify.js";
import uploadToCLoudinary from "../../utils/uploadToCloudinary.js";
import validateInput from "../../utils/validateInput.js";
// import uploadImage from "../../utils/uploadImage.js";

const module_name = "brand";

//create brand
// export const createBrand = async (req, res) => {
//   try {
//     return await prisma.$transaction(async (tx) => {
//       let { name, isActive } = req.body;

//       //   console.log(req.body);

//       //validate input
//       const inputValidation = validateInput([name], ["Name"]);

//       if (inputValidation) {
//         return res.status(400).json(jsonResponse(false, inputValidation, null));
//       }

//       //   if (serviceManufacturerId) {
//       //     if (serviceManufacturerId.trim() === "") {
//       //       serviceManufacturerId = undefined;
//       //     }
//       //   } else {
//       //     serviceManufacturerId = undefined;
//       //   }

//       //   if (serviceModelId) {
//       //     if (serviceModelId.trim() === "") {
//       //       serviceModelId = undefined;
//       //     }
//       //   } else {
//       //     serviceModelId = undefined;
//       //   }

//       //get user name for slugify
//       //   const user = await tx.inspectionUser.findFirst({
//       //     where: { id: req.user.parentId ? req.user.parentId : req.user.id },
//       //   });

//       //   if (!user)
//       //     return res
//       //       .status(404)
//       //       .json(jsonResponse(false, "This user does not exist", null));

//       //check if brand exists
//       const brand = await tx.brand.findFirst({
//         where: {
//           slug: slugify(name),
//         },
//       });

//       if (brand && brand?.slug === slugify(name))
//         return res
//           .status(409)
//           .json(
//             jsonResponse(
//               false,
//               `${name} already exists. Please change it`,
//               null
//             )
//           );

//       //if there is no image selected
//       if (!req.file) {
//         // return res
//         //   .status(400)
//         //   .json(jsonResponse(false, "Please select an image", null));
//         //create brand
//         const newBrand = await prisma.brand.create({
//           data: {
//             name,
//             isActive: isActive === "true" ? true : false,
//             slug: `${slugify(name)}`,
//           },
//         });

//         if (newBrand) {
//           return res
//             .status(200)
//             .json(jsonResponse(true, "Brand has been created", newBrand));
//         }
//       }

//       //upload image
//       // const imageUpload = await uploadImage(req.file);
//       await uploadToCLoudinary(req.file, module_name, async (error, result) => {
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

//         //create brand
//         const newBrand = await prisma.brand.create({
//           data: {
//             name,
//             isActive: isActive === "true" ? true : false,
//             image: result.secure_url,
//             slug: `${slugify(name)}`,
//           },
//         });

//         if (newBrand) {
//           return res
//             .status(200)
//             .json(jsonResponse(true, "Brand has been created", newBrand));
//         }
//       });
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };



// export const createBrand = async (req, res) => {
//   try {
//     return await prisma.$transaction(async (tx) => {

//       let { name, isActive } = req.body;

//       // ✅ Validate input
//       const inputValidation = validateInput([name], ["Name"]);

//       if (inputValidation) {
//         return res.status(400).json(
//           jsonResponse(false, inputValidation, null)
//         );
//       }

//       // ✅ Check duplicate brand
//       const existingBrand = await tx.brand.findFirst({
//         where: {
//           name: {
//             equals: name,
//             mode: "insensitive", // ⭐ case insensitive match
//           },
//         },
//       });

//       if (existingBrand) {
//         return res.status(409).json(
//           jsonResponse(false, `${name} already exists`, null)
//         );
//       }

//       // ⭐ Prepare brand data
//       const brandData = {
//         name,
//         isActive: isActive === "true",
//         slug: slugify(name),
//       };

//       // ✅ If image uploaded
//       if (req.file) {
//         await uploadToCLoudinary(
//           req.file,
//           module_name,
//           async (error, result) => {

//             if (error) {
//               return res.status(500).json(
//                 jsonResponse(false, error, null)
//               );
//             }

//             if (!result.secure_url) {
//               return res.status(500).json(
//                 jsonResponse(
//                   false,
//                   "Image upload failed",
//                   null
//                 )
//               );
//             }

//             brandData.image = result.secure_url;

//             const newBrand = await tx.brand.create({
//               data: brandData,
//             });

//             return res.status(200).json(
//               jsonResponse(
//                 true,
//                 "Brand created successfully",
//                 newBrand
//               )
//             );
//           }
//         );
//       } else {
//         // ✅ Without image
//         const newBrand = await tx.brand.create({
//           data: brandData,
//         });

//         return res.status(200).json(
//           jsonResponse(
//             true,
//             "Brand created successfully",
//             newBrand
//           )
//         );
//       }
//     });

//   } catch (error) {
//     console.log(error);

//     return res.status(500).json(
//       jsonResponse(false, error.message, null)
//     );
//   }
// };


// export const createBrand = async (req, res) => {
//   try {
//     const result = await prisma.$transaction(async (tx) => {

//       let { name, isActive, brandID, brandAddress } = req.body;

//       // ✅ Validate input (name required)
//       const inputValidation = validateInput([name], ["Name"]);

//       if (inputValidation) {
//         return res.status(400).json(
//           jsonResponse(false, inputValidation, null)
//         );
//       }

//       // ✅ Check duplicate brand name (case insensitive)
//       const existingBrand = await tx.brand.findFirst({
//         where: {
//           name: {
//             equals: name,
//             mode: "insensitive",
//           },
//         },
//       });

//       if (existingBrand) {
//         return res.status(409).json(
//           jsonResponse(false, `${name} already exists`, null)
//         );
//       }

//       // ✅ Optional: Check duplicate brandID (if provided)
//       if (brandID) {
//         const existingBrandID = await tx.brand.findFirst({
//           where: { brandID },
//         });

//         if (existingBrandID) {
//           return res.status(409).json(
//             jsonResponse(false, `Brand ID already exists`, null)
//           );
//         }
//       }

//       // ⭐ Prepare brand data
//       const brandData = {
//         name,
//         slug: slugify(name),
//         isActive: isActive === "true",
//         brandID: brandID || null,
//         brandAddress: brandAddress || null,
//       };

//       // ✅ If image uploaded
//       if (req.file) {
//         const uploadResult = await new Promise((resolve, reject) => {
//           uploadToCLoudinary(req.file, module_name, (error, result) => {
//             if (error) reject(error);
//             else resolve(result);
//           });
//         });

//         if (!uploadResult.secure_url) {
//           throw new Error("Image upload failed");
//         }

//         brandData.image = uploadResult.secure_url;
//       }

//       // ✅ Create brand
//       const newBrand = await tx.brand.create({
//         data: brandData,
//       });

//       return newBrand;
//     });

//     return res.status(200).json(
//       jsonResponse(true, "Brand created successfully", result)
//     );

//   } catch (error) {
//     console.log(error);

//     return res.status(500).json(
//       jsonResponse(false, error.message, null)
//     );
//   }
// };

export const createBrand = async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {

      let {
        name,
        isActive,
        brandID,
        brandAddress
      } = req.body;

      // ⭐ Normalize input
      name = name?.trim();

      // ✅ Validate name
      const inputValidation = validateInput([name], ["Name"]);

      if (inputValidation) {
        return res.status(400).json(
          jsonResponse(false, inputValidation, null)
        );
      }

      // ✅ Check duplicate brand name
      const existingBrand = await tx.brand.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      });

      if (existingBrand) {
        return res.status(409).json(
          jsonResponse(false, `${name} already exists`, null)
        );
      }

      // ✅ Auto generate brandID if not provided
      if (!brandID) {
        brandID = `BR-${Date.now()}`;
      }

      // ✅ Check duplicate brandID
      const existingBrandID = await tx.brand.findFirst({
        where: {
          brandID: brandID,
        },
      });

      if (existingBrandID) {
        return res.status(409).json(
          jsonResponse(false, "Brand ID already exists", null)
        );
      }

      // ⭐ Prepare brand data
      const brandData = {
        name,
        slug: slugify(name),
        isActive: isActive === "true",
        brandID,
        brandAddress: brandAddress || null,
      };

      // ✅ Upload image if exists
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          uploadToCLoudinary(
            req.file,
            module_name,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        if (!uploadResult?.secure_url) {
          throw new Error("Image upload failed");
        }

        brandData.image = uploadResult.secure_url;
      }

      // ✅ Create brand
      const newBrand = await tx.brand.create({
        data: brandData,
      });

      return newBrand;
    });

    return res.status(200).json(
      jsonResponse(true, "Brand created successfully", result)
    );

  } catch (error) {
    console.log(error);
    return res.status(500).json(
      jsonResponse(false, error.message, null)
    );
  }
};

//get all brands
export const getBrands = async (req, res) => {
  //   if (req.user.roleName !== "super-admin") {
  //     getCategoriesByUser(req, res);
  //   } else {
  try {
    const brands = await prisma.brand.findMany({
      where: {
        AND: [
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

    if (brands.length === 0)
      return res
        .status(200)
        .json(jsonResponse(true, "No brand is available", null));

    if (brands) {
      return res
        .status(200)
        .json(jsonResponse(true, `${brands.length} brands found`, brands));
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


// export const getBrands = async (req, res) => {
//   try {
//     const {
//       name = "",
//       brandID = "",
//       brandAddress = "",
//       page = 1,
//       limit = 10,
//     } = req.query;

//     const pageNumber = parseInt(page);
//     const limitNumber = parseInt(limit);
//     const skip = (pageNumber - 1) * limitNumber;

//     // 🔎 Dynamic where filter
//     const whereCondition = {
//       name: {
//         contains: name,
//         mode: "insensitive",
//       },
//       brandID: {
//         contains: brandID,
//         mode: "insensitive",
//       },
//       brandAddress: {
//         contains: brandAddress,
//         mode: "insensitive",
//       },
//     };

//     const brands = await prisma.brand.findMany({
//       where: whereCondition,
//       orderBy: {
//         createdAt: "desc",
//       },
//       skip,
//       take: limitNumber,
//     });

//     const total = await prisma.brand.count({
//       where: whereCondition,
//     });

//     return res.status(200).json(
//       jsonResponse(true, "Brands fetched successfully", {
//         total,
//         page: pageNumber,
//         limit: limitNumber,
//         data: brands,
//       })
//     );

//   } catch (error) {
//     console.log(error);
//     return res
//       .status(500)
//       .json(jsonResponse(false, error.message, null));
//   }
// };






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

//get single brand
// export const getBrand = async (req, res) => {
//   try {
//     const brand = await prisma.brand.findFirst({
//       where: { slug: req.params.slug },
//       //   where: { slug: req.params.id },
//       //   include: {
//       //     serviceItem: true,
//       //     serviceManufacturer: true,
//       //     serviceModel: true,
//       //   },
//     });

//     if (brand) {
//       return res.status(200).json(jsonResponse(true, `1 brand found`, brand));
//     } else {
//       return res
//         .status(404)
//         .json(jsonResponse(false, "No brand is available", null));
//     }
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };

export const getBrand = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res
        .status(400)
        .json(jsonResponse(false, "Slug or BrandID is required", null));
    }

    const brand = await prisma.brand.findFirst({
      where: {
        OR: [
          { slug: slug },
          { brandID: slug }, // 🔥 brandID দিয়েও search করবে
        ],
      },
    });

    if (!brand) {
      return res
        .status(404)
        .json(jsonResponse(false, "Brand not found", null));
    }

    return res
      .status(200)
      .json(jsonResponse(true, "Brand fetched successfully", brand));

  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(jsonResponse(false, error.message, null));
  }
};


//update brand
// export const updateBrand = async (req, res) => {
//   try {
//     return await prisma.$transaction(async (tx) => {
//       let { name, isActive } = req.body;

//       //validate input
//       const inputValidation = validateInput([name], ["Name"]);

//       if (inputValidation) {
//         return res.status(400).json(jsonResponse(false, inputValidation, null));
//       }

//       //   if (serviceManufacturerId) {
//       //     if (
//       //       serviceManufacturerId.trim() === "" ||
//       //       serviceManufacturerId === "null"
//       //     ) {
//       //       serviceManufacturerId = undefined;
//       //     }
//       //   } else {
//       //     serviceManufacturerId = undefined;
//       //   }

//       //   if (serviceModelId) {
//       //     if (serviceModelId.trim() === "" || serviceModelId === "null") {
//       //       serviceModelId = undefined;
//       //     }
//       //   } else {
//       //     serviceModelId = undefined;
//       //   }

//       //get user id from brand and user name from user for slugify
//       const findBrand = await tx.brand.findFirst({
//         where: { id: req.params.id },
//       });

//       if (!findBrand)
//         return res
//           .status(404)
//           .json(jsonResponse(false, "This brand does not exist", null));

//       //   const user = await tx.user.findFirst({
//       //     where: { id: findCategory.userId },
//       //   });

//       //   if (!user)
//       //     return res
//       //       .status(404)
//       //       .json(jsonResponse(false, "This user does not exist", null));

//       //check if slug already exists
//       if (name) {
//         if (
//           name?.toLowerCase()?.trim() !== findBrand?.name?.toLowerCase()?.trim()
//         ) {
//           const existingBrand = await tx.brand.findFirst({
//             where: {
//               id: req.params.id,
//             },
//           });

//           //   if (existingBanner && existingBanner.slug === `${slugify(name)}`) {
//           if (
//             existingBrand &&
//             existingBrand.name?.toLowerCase()?.trim() ===
//               name?.toLowerCase()?.trim()
//           ) {
//             return res
//               .status(409)
//               .json(
//                 jsonResponse(
//                   false,
//                   `${name} already exists. Change its name.`,
//                   null
//                 )
//               );
//           }
//         }
//       }

//       //upload image
//       // let imageUpload;
//       if (req.file) {
//         // imageUpload = await uploadImage(req.file);
//         await uploadToCLoudinary(
//           req.file,
//           module_name,
//           async (error, result) => {
//             if (error) {
//               console.error("error", error);
//               return res.status(404).json(jsonResponse(false, error, null));
//             }

//             if (!result.secure_url) {
//               return res
//                 .status(404)
//                 .json(
//                   jsonResponse(
//                     false,
//                     "Something went wrong while uploading image. Try again",
//                     null
//                   )
//                 );
//             }

//             //update brand
//             const brand = await prisma.brand.update({
//               where: { id: req.params.id },
//               data: {
//                 name,
//                 isActive: isActive === "true" ? true : false,
//                 image: result.secure_url,
//                 slug: name ? `${slugify(name)}` : findBrand.slug,
//               },
//             });

//             //delete previous uploaded image
//             await deleteFromCloudinary(
//               findBrand.image,
//               async (error, result) => {
//                 console.log("error", error);
//                 console.log("result", result);
//               }
//             );

//             if (brand) {
//               return res
//                 .status(200)
//                 .json(jsonResponse(true, `Brand has been updated`, brand));
//             } else {
//               return res
//                 .status(404)
//                 .json(jsonResponse(false, "Brand has not been updated", null));
//             }
//           }
//         );

//         // fs.unlinkSync(
//         //   `public\\images\\${module_name}\\${findCategory.image.split("/")[2]}`
//         // );
//       } else {
//         //if there is no image selected
//         //update category
//         const brand = await prisma.brand.update({
//           where: { id: req.params.id },
//           data: {
//             name,
//             isActive: isActive === "true" ? true : false,
//             image: findBrand.image,
//             slug: name ? `${slugify(name)}` : findBrand.slug,
//           },
//         });

//         if (brand) {
//           return res
//             .status(200)
//             .json(jsonResponse(true, `Brand has been updated`, brand));
//         } else {
//           return res
//             .status(404)
//             .json(jsonResponse(false, "Brand has not been updated", null));
//         }
//       }
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error, null));
//   }
// };


export const updateBrand = async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      let { name, isActive, brandID, brandAddress } = req.body;

      const brandIdParam = parseInt(req.params.id);

      // ✅ Find existing brand
      const findBrand = await tx.brand.findUnique({
        where: { id: brandIdParam },
      });

      if (!findBrand) {
        return res
          .status(404)
          .json(jsonResponse(false, "This brand does not exist", null));
      }

      // ✅ Validate name
      if (name) {
        const existingName = await tx.brand.findFirst({
          where: {
            name: {
              equals: name,
              mode: "insensitive",
            },
            NOT: { id: brandIdParam },
          },
        });

        if (existingName) {
          return res
            .status(409)
            .json(
              jsonResponse(
                false,
                `${name} already exists. Change its name.`,
                null
              )
            );
        }
      }

      // ✅ Validate brandID duplicate (if provided)
      if (brandID) {
        const existingBrandID = await tx.brand.findFirst({
          where: {
            brandID: brandID,
            NOT: { id: brandIdParam },
          },
        });

        if (existingBrandID) {
          return res
            .status(409)
            .json(
              jsonResponse(false, "Brand ID already exists", null)
            );
        }
      }

      // ⭐ Prepare update data
      const updateData = {
        name: name ?? findBrand.name,
        slug: name ? slugify(name) : findBrand.slug,
        isActive:
          isActive !== undefined
            ? isActive === "true"
            : findBrand.isActive,
        brandID: brandID ?? findBrand.brandID,
        brandAddress: brandAddress ?? findBrand.brandAddress,
      };

      // ✅ If image uploaded
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          uploadToCLoudinary(req.file, module_name, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });

        if (!uploadResult.secure_url) {
          throw new Error("Image upload failed");
        }

        updateData.image = uploadResult.secure_url;

        // delete old image
        if (findBrand.image) {
          await deleteFromCloudinary(findBrand.image, () => {});
        }
      }

      // ✅ Update brand
      const updatedBrand = await tx.brand.update({
        where: { id: brandIdParam },
        data: updateData,
      });

      return updatedBrand;
    });

    return res
      .status(200)
      .json(jsonResponse(true, "Brand has been updated", result));

  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(jsonResponse(false, error.message, null));
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

//delete brand
export const deleteBrand = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.delete({
        where: { id: req.params.id },
      });

      if (brand) {
        // fs.unlinkSync(
        //   `public\\images\\${module_name}\\${category.image.split("/")[2]}`
        // );
        await deleteFromCloudinary(brand.image, async (error, result) => {
          console.log("error", error);
          console.log("result", result);
        });

        return res
          .status(200)
          .json(jsonResponse(true, `Brand has been deleted`, brand));
      } else {
        return res
          .status(404)
          .json(jsonResponse(false, "Brand has not been deleted", null));
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//For Customer

//get all brands for customer
export const getBrandsForCustomer = async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      where: {
        isActive: true,
        AND: [
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
      //   select: {
      //     user: { select: { name: true, image: true } },
      //     id: true,
      //     name: true,
      //     image: true,
      //     slug: true,
      //     createdAt: true,
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

    if (brands.length === 0)
      return res
        .status(200)
        .json(jsonResponse(true, "No brand is available", null));

    if (brands) {
      return res
        .status(200)
        .json(jsonResponse(true, `${brands.length} brands found`, brands));
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "Something went wrong. Try again", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};



//get single brand for customer
export const getBrandForCustomer = async (req, res) => {
  try {
    const brand = await prisma.brand.findFirst({
      where: {
        // slug: req.params.slug,
        id: req.params.id,
      },
      //   include: {
      //     serviceItem: true,
      //     serviceManufacturer: true,
      //     serviceModel: true,
      //   },
      //   select: {
      //     user: { select: { name: true, image: true } },
      //     id: true,
      //     name: true,
      //     image: true,
      //     slug: true,
      //     createdAt: true,
      //   },
    });

    if (brand) {
      return res.status(200).json(jsonResponse(true, `1 brand found`, brand));
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "No brand is available", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};
