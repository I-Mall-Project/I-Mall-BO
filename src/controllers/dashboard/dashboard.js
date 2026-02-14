import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";

const module_name = "dashboard";

//get all total category by user
export const getTotalCategory = async (req, res) => {
  try {
    const totalCategory = await prisma.category.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        isDeleted: false,
        isActive: true,
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(true, `${totalCategory} categories found`, totalCategory)
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total campaign by user
export const getTotalCampaign = async (req, res) => {
  try {
    const totalCampaign = await prisma.campaign.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        isDeleted: false,
        isActive: true,
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(true, `${totalCampaign} campaigns found`, totalCampaign)
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total product by user
export const getTotalProduct = async (req, res) => {
  try {
    const totalProduct = await prisma.product.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        isDeleted: false,
        isActive: true,
      },
    });

    return res
      .status(200)
      .json(jsonResponse(true, `${totalProduct} products found`, totalProduct));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total order by user
export const getTotalOrder = async (req, res) => {
  try {
    const totalOrder = await prisma.order.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
      },
    });

    return res
      .status(200)
      .json(jsonResponse(true, `${totalOrder} orders found`, totalOrder));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total pending order by user
export const getPendingOrder = async (req, res) => {
  try {
    const pendingOrder = await prisma.order.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        status: "PENDING",
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(true, `${pendingOrder} pending orders found`, pendingOrder)
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total canceled order by user
export const getCanceledOrder = async (req, res) => {
  try {
    const canceledOrder = await prisma.order.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        status: "CANCELED",
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `${canceledOrder} canceled orders found`,
          canceledOrder
        )
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total delivered order by user
export const getDeliveredOrder = async (req, res) => {
  try {
    const deliveredOrder = await prisma.order.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        status: "DELIVERED",
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `${deliveredOrder} delivered orders found`,
          deliveredOrder
        )
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total inprogress order by user
export const getInProgressOrder = async (req, res) => {
  try {
    const inProgressOrder = await prisma.order.count({
      where: {
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
        status: "SHIPPED",
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `${inProgressOrder} in progress orders found`,
          inProgressOrder
        )
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total revenue by user
export const getTotalRevenue = async (req, res) => {
  try {
    const subtotal = await prisma.order.aggregate({
      // where: { userId: req.user.parentId ? req.user.parentId : req.user.id },
      _sum: {
        subtotal: true,
        subtotalCost: true,
      },
    });

    const totalRevenue = subtotal._sum.subtotal - subtotal._sum.subtotalCost;

    return res
      .status(200)
      .json(
        jsonResponse(true, `Total revenue is ${totalRevenue}`, totalRevenue)
      );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get all total revenue year wise by user
export const getTotalRevenueYearWise = async (req, res) => {
  try {
    const currentYear = req.params.year
      ? Number(req.params.year)
      : new Date().getFullYear();

    const monthlyRevenues = await prisma.$queryRaw`
  SELECT 
    EXTRACT(MONTH FROM "createdAt") AS month,
    SUM("subtotal") AS total_subtotal,
    SUM("subtotalCost") AS total_subtotalCost
  FROM "Order"
  WHERE "createdAt" >= ${new Date(`${currentYear}-01-01`)}
    AND "createdAt" < ${new Date(`${currentYear + 1}-01-01`)}
  GROUP BY EXTRACT(MONTH FROM "createdAt")
  ORDER BY month ASC;
`;

    // WHERE "userId" = ${req.user.parentId ? req.user.parentId : req.user.id}

    console.log({ monthlyRevenues });

    const revenues = monthlyRevenues.map((row) => ({
      month: row.month,
      revenue: row.total_subtotal - row.total_subtotalcost,
    }));

    return res
      .status(200)
      .json(jsonResponse(true, `Revenue generated`, revenues));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

// get today's total orders
export const getTodayTotalOrder = async (req, res) => {
  try {
    // আজকের দিনের শুরু (12:00 AM)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalOrder = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
        // user wise লাগলে uncomment করো
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
      },
    });

    return res.status(200).json(
      jsonResponse(
        true,
        `Today total ${totalOrder} orders`,
        totalOrder
      )
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};



// Get today's total sell amount (subtotal)
export const getTodaySellAmount = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // আজকের দিন শুরু

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: startOfDay, // আজকের date থেকে
        },
        status: "DELIVERED", // ✅ শুধু delivered order
        // user-wise চাইলে
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
      },
      _sum: {
        subtotal: true,
      },
    });

    const todaySellAmount = subtotal._sum.subtotal || 0;

    return res.status(200).json(
      jsonResponse(
        true,
        `Today's delivered sell is ${todaySellAmount}`,
        todaySellAmount
      )
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};



// Get today's total revenue (profit)
export const getTodayRevenue = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // আজকের দিন শুরু

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: startOfDay,
        },
        status: "DELIVERED", // ✅ only delivered orders
        // user-wise filter চাইলে
        // userId: req.user.parentId ? req.user.parentId : req.user.id,
      },
      _sum: {
        subtotal: true,       // sell
        subtotalCost: true,   // cost
      },
    });

    const todayRevenue =
      (subtotal._sum.subtotal || 0) -
      (subtotal._sum.subtotalCost || 0);

    return res.status(200).json(
      jsonResponse(
        true,
        `Today's delivered revenue is ${todayRevenue}`,
        todayRevenue
      )
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

// GET /v1/sale/last-week
export const getLastWeekSale = async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(today);
    endOfWeek.setHours(23, 59, 59, 999);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfWeek, lte: endOfWeek },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },
         status: "DELIVERED",
      _sum: {
        subtotal: true,
      },
    });

    const totalSellAmount = subtotal._sum.subtotal || 0;

    return res.status(200).json(jsonResponse(true, "Last Week Sell Amount", totalSellAmount));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};



// GET /v1/sale/last-month
export const getLastMonthSale = async (req, res) => {
  try {
    const today = new Date();
    const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const year = lastMonth === 11 ? today.getFullYear() - 1 : today.getFullYear();

    const startOfLastMonth = new Date(year, lastMonth, 1, 0, 0, 0);
    const endOfLastMonth = new Date(year, lastMonth + 1, 0, 23, 59, 59);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },

         status: "DELIVERED",
      _sum: {
        subtotal: true, // total sell amount
      },
    });

    const totalSellAmount = subtotal._sum.subtotal || 0;

    return res.status(200).json(jsonResponse(true, "Last Month Sell Amount", totalSellAmount));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


// GET /v1/sale/last-year
export const getLastYearSale = async (req, res) => {
  try {
    const lastYear = new Date().getFullYear() - 1;
    const startOfLastYear = new Date(lastYear, 0, 1, 0, 0, 0);
    const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfLastYear, lte: endOfLastYear },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },

         status: "DELIVERED",
      _sum: {
        subtotal: true, // total sell amount
      },
    });

    const totalSellAmount = subtotal._sum.subtotal || 0;

    return res.status(200).json(jsonResponse(true, "Last Year Sell Amount", totalSellAmount));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


// GET /v1/revenue/last-week
export const getLastWeekRevenue = async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(today);
    endOfWeek.setHours(23, 59, 59, 999);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfWeek, lte: endOfWeek },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },

         status: "DELIVERED",
      _sum: {
        subtotal: true,
        subtotalCost: true,
      },
    });

    const revenue = (subtotal._sum.subtotal || 0) - (subtotal._sum.subtotalCost || 0);

    return res.status(200).json(jsonResponse(true, "Last Week Revenue", revenue));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


// GET /v1/revenue/last-month
export const getLastMonthRevenue = async (req, res) => {
  try {
    const today = new Date();
    const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const year = lastMonth === 11 ? today.getFullYear() - 1 : today.getFullYear();

    const startOfLastMonth = new Date(year, lastMonth, 1, 0, 0, 0);
    const endOfLastMonth = new Date(year, lastMonth + 1, 0, 23, 59, 59);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },

         status: "DELIVERED",
      _sum: {
        subtotal: true,
        subtotalCost: true,
      },
    });

    const revenue = (subtotal._sum.subtotal || 0) - (subtotal._sum.subtotalCost || 0);

    return res.status(200).json(jsonResponse(true, "Last Month Revenue", revenue));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};


// GET /v1/revenue/last-year
export const getLastYearRevenue = async (req, res) => {
  try {
    const lastYear = new Date().getFullYear() - 1;
    const startOfLastYear = new Date(lastYear, 0, 1, 0, 0, 0);
    const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59);

    const subtotal = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfLastYear, lte: endOfLastYear },
        // userId: req.user.parentId ? req.user.parentId : req.user.id
      },
          status: "DELIVERED",
      _sum: {
        subtotal: true,
        subtotalCost: true,
      },
    });

    const revenue = (subtotal._sum.subtotal || 0) - (subtotal._sum.subtotalCost || 0);

    return res.status(200).json(jsonResponse(true, "Last Year Revenue", revenue));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};



// get total sell amount for current year
export const getCurrentYearSell = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const totalSell = await prisma.order.aggregate({
      _sum: {
        subtotal: true, // assuming subtotal is sell amount
      },

         status: "DELIVERED",
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    });

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `Total sell for ${currentYear} is ${totalSell._sum.subtotal || 0}`,
          totalSell._sum.subtotal || 0
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};


// get total revenue (profit) for current year
export const getCurrentYearRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const subtotal = await prisma.order.aggregate({
      _sum: {
        subtotal: true,      // total sell
        subtotalCost: true,  // total cost
      },
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
        status: "DELIVERED",
      },
    });

    const totalRevenue = (subtotal._sum.subtotal || 0) - (subtotal._sum.subtotalCost || 0);

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `Total revenue for ${currentYear} is ${totalRevenue}`,
          totalRevenue
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};


export const getCurrentMonthSell = async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    // fetch only orders where subtotal > 0
    const result = await prisma.order.aggregate({
      _sum: {
        subtotal: true,
      },
      where: {
        subtotal: { gt: 0 }, // ignore null or 0
        createdAt: { gte: firstDay, lt: lastDay },
           status: "DELIVERED",
      },
    });

    const totalSell = result._sum.subtotal || 0;

    return res.status(200).json(
      jsonResponse(
        true,
        `Total sell for current month is ${totalSell}`,
        totalSell
      )
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};


// get total revenue (profit) for current month
export const getCurrentMonthRevenue = async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const subtotal = await prisma.order.aggregate({
      _sum: {
        subtotal: true,
        subtotalCost: true,
      },
      where: {
        createdAt: {
          gte: firstDay,
          lt: lastDay,
        },

           status: "DELIVERED",
      },
    });

    const totalRevenue = (subtotal._sum.subtotal || 0) - (subtotal._sum.subtotalCost || 0);

    return res
      .status(200)
      .json(
        jsonResponse(
          true,
          `Total revenue for current month is ${totalRevenue}`,
          totalRevenue
        )
      );
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};
