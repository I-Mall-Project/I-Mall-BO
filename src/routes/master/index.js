// ============================================================
// routes/master/index.js
//
// brand/index.js এর pattern অনুযায়ী — কিন্তু import আর variable
// এর নাম আলাদা রাখা হয়েছে যাতে conflict না হয়
// ============================================================
import masterCatalogRouter from "./master.js";

const masterCatalogRoutes = [masterCatalogRouter];

export default masterCatalogRoutes;