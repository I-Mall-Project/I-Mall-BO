// ============================================================
// controllers/masterCatalog.controller.js
//
// ⚠️ Field names এই ফাইলে আপনার Neon DB থেকে `prisma db pull`
// করার পর যেটা schema.prisma এ এসেছে, সেটার সাথে exactly মিলিয়ে লেখা।
// Model: master_catalog, shop_catalog_items (snake_case)
//
// createProduct ফাংশন import করে call করা হয় — সেটার ভিতরের
// কোনো logic এখানে duplicate করা হয়নি।
// ============================================================

import prisma from "../../utils/prismaClient.js";

import { createProduct } from "../product/product.js";

const MEDICINE_CATEGORY_ID = "c0d2ae43-e1cc-4ff0-b281-178862322a21";


// ============================================================
// controllers/masterCatalog.controller.js
//
// ⚠️ Field names এই ফাইলে আপনার Neon DB থেকে `prisma db pull`
// করার পর যেটা schema.prisma এ এসেছে, সেটার সাথে exactly মিলিয়ে লেখা।
// Model: master_catalog, shop_catalog_items (snake_case)
//
// createProduct ফাংশন import করে call করা হয় — সেটার ভিতরের
// কোনো logic এখানে duplicate করা হয়নি।
// ============================================================




// ------------------------------------------------------------
// 1. SEARCH — Master Catalog থেকে medicines খোঁজা
// GET /api/master-catalog?q=napa&dosageForm=Tablet&brandId=12&page=1
// ------------------------------------------------------------
export const searchMasterCatalog = async (req, res) => {
  try {
    const { q = "", dosageForm = "", page = 1, limit = 20, brandId } = req.query;

    if (!brandId) {
      return res.status(400).json({ success: false, message: "brandId প্রয়োজন" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      is_active: true,
      ...(q && {
        OR: [
          { medicine_name: { contains: q, mode: "insensitive" } },
          { generic_name:  { contains: q, mode: "insensitive" } },
          { company_name:  { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(dosageForm && { dosage_form: dosageForm }),
    };

    const [medicines, total] = await Promise.all([
      prisma.master_catalog.findMany({
        where,
        skip,
        take:    Number(limit),
        orderBy: { medicine_name: "asc" },
        select: {
          id:            true,
          medicine_name: true,
          generic_name:  true,
          strength:      true,
          dosage_form:   true,
          company_name:  true,
          price_1pc:     true,
          price_10pc:    true,
          shop_catalog_items: {
            where:  { brand_id: String(brandId) },
            select: { id: true },
          },
        },
      }),
      prisma.master_catalog.count({ where }),
    ]);

    const data = medicines.map((m) => ({
      id:           m.id,
      medicineName: m.medicine_name,
      genericName:  m.generic_name,
      strength:     m.strength,
      dosageForm:   m.dosage_form,
      companyName:  m.company_name,
      price1pc:     m.price_1pc,
      price10pc:    m.price_10pc,
      alreadyAdded: m.shop_catalog_items.length > 0,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page:  Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("searchMasterCatalog error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ------------------------------------------------------------
// 2. FILTERS — Dosage form dropdown এর জন্য
// GET /api/master-catalog/filters
// ------------------------------------------------------------
export const getCatalogFilters = async (req, res) => {
  try {
    const forms = await prisma.master_catalog.findMany({
      where:    { is_active: true },
      select:   { dosage_form: true },
      distinct: ["dosage_form"],
      orderBy:  { dosage_form: "asc" },
    });

    return res.status(200).json({
      success:     true,
      dosageForms: forms.map((f) => f.dosage_form).filter(Boolean),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ------------------------------------------------------------
// 🔑 MAPPING FUNCTION
// master_catalog (snake_case DB) → createProduct এর expected req.body
// ------------------------------------------------------------
function mapMedicineToProductBody(med, brandId) {
  const productAttributes = [];

  if (med.price_1pc) {
    productAttributes.push({
      size:        "1 PC",
      costPrice:   Number(med.price_1pc) ,
      retailPrice: Number(med.price_1pc),
      stockAmount: 0,
    });
  }

  // if (med.price_10pc) {
  //   productAttributes.push({
  //     size:        "10 PCS",
  //     costPrice:   Number(med.price_10pc) * 0.85,
  //     retailPrice: Number(med.price_10pc),
  //     stockAmount: 0,
  //   });
  // }

  return {
    name:              med.medicine_name,
    brandId:           String(brandId),
    categoryId:        MEDICINE_CATEGORY_ID,
    shortDescription:  [med.generic_name, med.strength, med.dosage_form]
                          .filter(Boolean).join(" | "),
    isActive:          "true",
    isTrending:        "false",
    isFeatured:        "false",
    productAttributes,
  };
}


// ------------------------------------------------------------
// 3. BULK ADD — createProduct() কে আসলে call করে
// POST /api/master-catalog/bulk-add
// body: { catalogIds: [1, 5, 23], brandId: 12 }
// ------------------------------------------------------------
// export const bulkAddToShop = async (req, res) => {
//   try {
//     const { catalogIds, brandId } = req.body;

//     if (!brandId) {
//       return res.status(400).json({ success: false, message: "brandId প্রয়োজন" });
//     }
//     if (!catalogIds?.length) {
//       return res.status(400).json({ success: false, message: "কোনো medicine select করা হয়নি" });
//     }

//     // Already added বাদ দিন
//     const existing = await prisma.shop_catalog_items.findMany({
//       where:  { brand_id: String(brandId), catalog_id: { in: catalogIds } },
//       select: { catalog_id: true },
//     });
//     const existingIds = new Set(existing.map((e) => e.catalog_id));
//     const newIds       = catalogIds.filter((id) => !existingIds.has(id));

//     if (!newIds.length) {
//       return res.status(200).json({ success: true, message: "সব medicine আগেই add করা আছে", added: 0 });
//     }

//     const medicines = await prisma.master_catalog.findMany({
//       where: { id: { in: newIds }, is_active: true },
//     });

//     const successList = [];
//     const failedList  = [];

//     for (const med of medicines) {
//       try {
//         const result = await callCreateProduct(
//           mapMedicineToProductBody(med, brandId),
//           req.user
//         );

//         if (result.success) {
//           await prisma.shop_catalog_items.create({
//             data: {
//               brand_id:   String(brandId),
//               catalog_id: med.id,
//               product_id: result.data.id,
//             },
//           });
//           successList.push(med.medicine_name);
//         } else {
//           failedList.push({ name: med.medicine_name, reason: result.message });
//         }
//       } catch (err) {
//         failedList.push({ name: med.medicine_name, reason: err.message });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `${successList.length}টি medicine আপনার shop এ add হয়েছে`,
//       added:  successList.length,
//       failed: failedList.length,
//       failedDetails: failedList,
//     });
//   } catch (error) {
//     console.error("bulkAddToShop error:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };


export const bulkAddToShop = async (req, res) => {
  try {
    const { catalogIds, brandId, overrides = [] } = req.body;

    if (!brandId) {
      return res.status(400).json({ success: false, message: "brandId প্রয়োজন" });
    }
    if (!catalogIds?.length) {
      return res.status(400).json({ success: false, message: "কোনো medicine select করা হয়নি" });
    }

    // overrides কে map এ convert করো
    const overrideMap = {};
    for (const o of overrides) {
      overrideMap[o.id] = o;
    }

    // Already added বাদ দিন
    const existing = await prisma.shop_catalog_items.findMany({
      where:  { brand_id: String(brandId), catalog_id: { in: catalogIds } },
      select: { catalog_id: true },
    });
    const existingIds = new Set(existing.map((e) => e.catalog_id));
    const newIds      = catalogIds.filter((id) => !existingIds.has(id));

    if (!newIds.length) {
      return res.status(200).json({ success: true, message: "সব medicine আগেই add করা আছে", added: 0 });
    }

    const medicines = await prisma.master_catalog.findMany({
      where: { id: { in: newIds }, is_active: true },
    });

    const successList = [];
    const failedList  = [];

    for (const med of medicines) {
      try {
        const body     = mapMedicineToProductBody(med, brandId);
        const override = overrideMap[med.id];

        // override থাকলে price ও stock replace করো
        if (override && body.productAttributes.length > 0) {
          body.productAttributes[0].retailPrice = Number(override.retailPrice);
          body.productAttributes[0].costPrice   = Number(override.costPrice);
          body.productAttributes[0].stockAmount = Number(override.stockAmount);
        }

        const result = await callCreateProduct(body, req.user);

        if (result.success) {
          await prisma.shop_catalog_items.create({
            data: {
              brand_id:   String(brandId),
              catalog_id: med.id,
              product_id: result.data.id,
            },
          });
          successList.push(med.medicine_name);
        } else {
          failedList.push({ name: med.medicine_name, reason: result.message });
        }
      } catch (err) {
        failedList.push({ name: med.medicine_name, reason: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${successList.length}টি medicine আপনার shop এ add হয়েছে`,
      added:   successList.length,
      failed:  failedList.length,
      failedDetails: failedList,
    });
  } catch (error) {
    console.error("bulkAddToShop error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------------------------------------------------
// 🔑 HELPER — createProduct(req, res) কে function call এর মতো use করা
// ------------------------------------------------------------
function callCreateProduct(body, user) {
  return new Promise((resolve) => {
    const fakeReq = { body, files: [], user };

    const fakeRes = {
      status(code) {
        this._statusCode = code;
        return this;
      },
      json(payload) {
        resolve({
          success: payload.success,
          message: payload.message,
          data:    payload.data,
        });
        return this;
      },
    };

    createProduct(fakeReq, fakeRes);
  });
}