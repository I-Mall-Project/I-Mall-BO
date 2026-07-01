/**
 * import_medicines.js
 * =====================================
 * Excel → Neon DB (master_catalog table)
 *
 * একবার রান করলেই ২১,৭১৪ medicines DB তে চলে যাবে।
 * কোনো createProduct API call হবে না — এটা শুধু raw data import।
 *
 * Setup:
 *   npm install xlsx @prisma/client
 *
 * Run:
 *   node import_medicines.js
 *
 * প্রজেক্টের root এ এই ফাইল রাখুন,
 * পাশে Bangladesh_Medicine_Database.xlsx ফাইলটাও রাখুন।
 */

import xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXCEL_PATH = "./Bangladesh_Medicine_Database.xlsx";
const SHEET_NAME = "Medicine Database";
const BATCH_SIZE = 500;

async function main() {
  console.log("📂 Excel পড়া হচ্ছে...");

  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[SHEET_NAME];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const dataRows = rows.slice(1); // header skip
  console.log(`✅ মোট ${dataRows.length} rows পাওয়া গেছে`);

  const medicines = [];
  let skipped = 0;

  for (const row of dataRows) {
    const [
      _alphabet,
      name,
      _available,
      genericName,
      strength,
      dosageForm,
      companyName,
      price1pc,
      price10pc,
    ] = row;

    if (!name) {
      skipped++;
      continue;
    }

    medicines.push({
      medicine_name: String(name).trim(),
      generic_name: genericName ? String(genericName).trim() : null,
      strength: strength ? String(strength).trim() : null,
      dosage_form: dosageForm ? String(dosageForm).trim() : null,
      company_name: companyName ? String(companyName).trim() : null,
      price_1pc: price1pc ? Number(price1pc) : null,
      price_10pc: price10pc ? Number(price10pc) : null,
      category: "medicine",
    });
  }

  console.log(`⚠️  Skipped (খালি row): ${skipped}`);
  console.log(`📦 Import হবে: ${medicines.length} medicines`);

  let inserted = 0;
  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch = medicines.slice(i, i + BATCH_SIZE);
    await prisma.master_catalog.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += batch.length;
    console.log(`⏳ ${inserted} / ${medicines.length} ইনসার্ট হয়েছে...`);
  }

  const count = await prisma.master_catalog.count({
    where: { category: "medicine" },
  });

  console.log(`\n✅ Done! Neon DB এ এখন মোট ${count} medicines আছে।`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Import এ সমস্যা হয়েছে:", err);
  await prisma.$disconnect();
  process.exit(1);
});