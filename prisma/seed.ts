import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting PlaybookMD seed...\n");

  // ─── CLEAN SLATE ──────────────────────────────────────────────────────────────
  console.log("Cleaning existing data...");
  await prisma.treatmentPlanItem.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.appointmentHold.deleteMany();
  await prisma.implantRecord.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.document.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.task.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.appointmentSubcategory.deleteMany();
  await prisma.configuredAppointmentType.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.opportunityForm.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.pipelineAutomationRule.deleteMany();
  await prisma.opportunityProcedure.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.procedureType.deleteMany();
  await prisma.leadSource.deleteMany();
  await prisma.practiceTag.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.practice.deleteMany();
  console.log("Clean slate ready.\n");

  // ─── IDS ──────────────────────────────────────────────────────────────────────
  const practiceId = "practice_1";

  const userSofiaId = "user_sofia";
  const userAmandaId = "user_amanda";
  const userCarlosId = "user_carlos";
  const userPriyaId = "user_priya";
  const userJessicaId = "user_jessica";

  const pipelineNonSurgId = "pipeline_nonsurg";
  const pipelineSurgId = "pipeline_surg";

  // Non-surgical stages
  const nsNewInquiry = "ns_new_inquiry";
  const nsResponsive = "ns_responsive";
  const nsUnresponsive = "ns_unresponsive";
  const nsConsultBooked = "ns_consult_booked";
  const nsConsultCompleted = "ns_consult_completed";
  const nsQuoteSent = "ns_quote_sent";
  const nsExpiringQuote = "ns_expiring_quote";
  const nsDepositPaid = "ns_deposit_paid";
  const nsTreatmentComplete = "ns_treatment_complete";

  // Surgical stages
  const sNewInquiry = "s_new_inquiry";
  const sResponsive = "s_responsive";
  const sUnresponsive = "s_unresponsive";
  const sConsultBooked = "s_consult_booked";
  const sConsultCompleted = "s_consult_completed";
  const sQuoteSent = "s_quote_sent";
  const sExpiringQuote = "s_expiring_quote";
  const sSurgeryBooked = "s_surgery_booked";
  const sPreOpComplete = "s_preop_complete";
  const sPostOpRecall = "s_postop_recall";

  // Procedure IDs
  const procBotox = "proc_botox";
  const procFillers = "proc_fillers";
  const procChemPeel = "proc_chem_peel";
  const procHydrafacial = "proc_hydrafacial";
  const procLaser = "proc_laser";
  const procMicroneedling = "proc_microneedling";
  const procRhino = "proc_rhinoplasty";
  const procBreast = "proc_breast_aug";
  const procFacelift = "proc_facelift";
  const procBleph = "proc_blepharoplasty";
  const procTummy = "proc_tummy_tuck";
  const procMommy = "proc_mommy_makeover";

  // Patient IDs
  const patMaria = "pat_maria";
  const patJames = "pat_james";
  const patCamila = "pat_camila";
  const patDavid = "pat_david";
  const patIsabella = "pat_isabella";
  const patRobert = "pat_robert";
  const patValentina = "pat_valentina";
  const patMichael = "pat_michael";
  const patLucia = "pat_lucia";
  const patAlex = "pat_alex";
  const patNatalia = "pat_natalia";
  const patCarlos = "pat_carlos_p";
  const patEmily = "pat_emily";
  const patSophie = "pat_sophie";
  const patDaniel = "pat_daniel";

  // ─── PRACTICE ─────────────────────────────────────────────────────────────────
  console.log("Creating practice...");
  await prisma.practice.upsert({
    where: { id: practiceId },
    update: {},
    create: {
      id: practiceId,
      clerkOrgId: process.env.CLERK_TEST_ORG_ID || null,
      name: "Luminary Aesthetics",
      address: "1200 Brickell Ave Suite 400",
      city: "Miami",
      state: "FL",
      phone: "(305) 555-0100",
      email: "info@luminaryaesthetics.com",
      timezone: "America/New_York",
    },
  });

  // ─── PRACTICE TAGS ──────────────────────────────────────────────────────────────
  console.log("Creating practice tags...");
  const defaultTags = [
    { name: "VIP", color: "#10B981", emoji: "👑", sortOrder: 0 },
    { name: "PITA", color: "#F97316", emoji: null, sortOrder: 1 },
    { name: "Discharged", color: "#EF4444", emoji: "⛔", sortOrder: 2 },
    { name: "Surgical Candidate", color: "#8B5CF6", emoji: null, sortOrder: 3 },
    { name: "Financing Needed", color: "#3B82F6", emoji: null, sortOrder: 4 },
    { name: "High Value", color: "#F59E0B", emoji: "💎", sortOrder: 5 },
    { name: "Recall Priority", color: "#EC4899", emoji: null, sortOrder: 6 },
  ];
  for (const tag of defaultTags) {
    await prisma.practiceTag.create({
      data: { practiceId, name: tag.name, color: tag.color, emoji: tag.emoji, sortOrder: tag.sortOrder, status: "ACTIVE" },
    });
  }

  // ─── LEAD SOURCES ──────────────────────────────────────────────────────────────
  console.log("Creating lead sources...");
  const leadSourcesData = [
    { name: "Website", channelType: "ORGANIC" as const, sortOrder: 0 },
    { name: "Google Ads", channelType: "PAID" as const, sortOrder: 1 },
    { name: "Google Organic", channelType: "ORGANIC" as const, sortOrder: 2 },
    { name: "Facebook Ads", channelType: "PAID" as const, sortOrder: 3 },
    { name: "Facebook Organic", channelType: "ORGANIC" as const, sortOrder: 4 },
    { name: "Instagram Organic", channelType: "ORGANIC" as const, sortOrder: 5 },
    { name: "TikTok Ads", channelType: "PAID" as const, sortOrder: 6 },
    { name: "TikTok Organic", channelType: "ORGANIC" as const, sortOrder: 7 },
    { name: "Word of Mouth", channelType: "RELATIONSHIP" as const, sortOrder: 8 },
    { name: "Referral", channelType: "RELATIONSHIP" as const, sortOrder: 9 },
    { name: "Physician Referral", channelType: "RELATIONSHIP" as const, sortOrder: 10 },
    { name: "Existing Patient Referral", channelType: "RELATIONSHIP" as const, sortOrder: 11 },
    { name: "Walk-In", channelType: "RELATIONSHIP" as const, sortOrder: 12 },
    { name: "Reddit", channelType: "ORGANIC" as const, sortOrder: 13 },
    { name: "RealSelf", channelType: "ORGANIC" as const, sortOrder: 14 },
    { name: "Yelp", channelType: "ORGANIC" as const, sortOrder: 15 },
  ];
  for (const ls of leadSourcesData) {
    await prisma.leadSource.create({
      data: { practiceId, name: ls.name, channelType: ls.channelType, sortOrder: ls.sortOrder, status: "ACTIVE" },
    });
  }

  // ─── PROCEDURE TYPES ──────────────────────────────────────────────────────────
  console.log("Creating procedure types...");
  const procedureTypesData = [
    { name: "Facelift", category: "SURGICAL" as const, sortOrder: 0 },
    { name: "Rhinoplasty", category: "SURGICAL" as const, sortOrder: 1 },
    { name: "Neck Lift", category: "SURGICAL" as const, sortOrder: 2 },
    { name: "Breast Augmentation", category: "SURGICAL" as const, sortOrder: 3 },
    { name: "Breast Lift", category: "SURGICAL" as const, sortOrder: 4 },
    { name: "Tummy Tuck", category: "SURGICAL" as const, sortOrder: 5 },
    { name: "Liposuction", category: "SURGICAL" as const, sortOrder: 6 },
    { name: "Blepharoplasty", category: "SURGICAL" as const, sortOrder: 7 },
    { name: "Brow Lift", category: "SURGICAL" as const, sortOrder: 8 },
    { name: "Hair Transplant", category: "HAIR" as const, sortOrder: 9 },
    { name: "Laser Skin Resurfacing", category: "NON_SURGICAL" as const, sortOrder: 10 },
    { name: "Injectables", category: "NON_SURGICAL" as const, sortOrder: 11 },
    { name: "Chemical Peel", category: "SKINCARE" as const, sortOrder: 12 },
    { name: "Facials", category: "SKINCARE" as const, sortOrder: 13 },
  ];
  for (const pt of procedureTypesData) {
    await prisma.procedureType.create({
      data: { practiceId, name: pt.name, category: pt.category, sortOrder: pt.sortOrder, status: "ACTIVE" },
    });
  }

  // ─── USERS ────────────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const usersData = [
    { id: userSofiaId, clerkId: "clerk_sofia", firstName: "Sofia", lastName: "Reyes", email: "sofia@luminaryaesthetics.com", role: "ADMIN" as const },
    { id: userAmandaId, clerkId: "clerk_amanda", firstName: "Amanda", lastName: "Torres", email: "amanda@luminaryaesthetics.com", role: "ADMIN" as const },
    { id: userCarlosId, clerkId: "clerk_carlos", firstName: "Carlos", lastName: "Mendez", email: "carlos@luminaryaesthetics.com", role: "COORDINATOR" as const },
    { id: userPriyaId, clerkId: "clerk_priya", firstName: "Priya", lastName: "Patel", email: "priya@luminaryaesthetics.com", role: "FRONT_DESK" as const },
    { id: userJessicaId, clerkId: "clerk_jessica", firstName: "Jessica", lastName: "Wu", email: "jessica@luminaryaesthetics.com", role: "PROVIDER" as const },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: { ...u, practiceId },
    });
  }

  // ─── PIPELINES & STAGES ───────────────────────────────────────────────────────
  console.log("Creating pipelines and stages...");

  await prisma.pipeline.upsert({
    where: { id: pipelineNonSurgId },
    update: {},
    create: { id: pipelineNonSurgId, practiceId, name: "Non-Surgical", isDefault: true, order: 0 },
  });

  await prisma.pipeline.upsert({
    where: { id: pipelineSurgId },
    update: {},
    create: { id: pipelineSurgId, practiceId, name: "Surgical", isDefault: false, order: 1 },
  });

  const nonSurgStages = [
    { id: nsNewInquiry, name: "New Inquiry", order: 0, color: "#3B82F6", rottingThresholdHours: 4 },
    { id: nsResponsive, name: "Responsive", order: 1, color: "#10B981", rottingThresholdHours: 24 },
    { id: nsUnresponsive, name: "Unresponsive", order: 2, color: "#F59E0B", rottingThresholdHours: 48 },
    { id: nsConsultBooked, name: "Consult Booked", order: 3, color: "#8B5CF6", rottingThresholdHours: 72 },
    { id: nsConsultCompleted, name: "Consult Completed", order: 4, color: "#6366F1", rottingThresholdHours: 48 },
    { id: nsQuoteSent, name: "Quote Sent", order: 5, color: "#F97316", rottingThresholdHours: 120 },
    { id: nsExpiringQuote, name: "Expiring Quote", order: 6, color: "#EF4444", rottingThresholdHours: 24 },
    { id: nsDepositPaid, name: "Deposit Paid", order: 7, color: "#059669", isWon: true, rottingThresholdHours: 168 },
    { id: nsTreatmentComplete, name: "Treatment Complete", order: 8, color: "#6B7280", rottingThresholdHours: 336 },
  ];

  const surgStages = [
    { id: sNewInquiry, name: "New Inquiry", order: 0, color: "#3B82F6", rottingThresholdHours: 4 },
    { id: sResponsive, name: "Responsive", order: 1, color: "#10B981", rottingThresholdHours: 24 },
    { id: sUnresponsive, name: "Unresponsive", order: 2, color: "#F59E0B", rottingThresholdHours: 48 },
    { id: sConsultBooked, name: "Consult Booked", order: 3, color: "#8B5CF6", rottingThresholdHours: 72 },
    { id: sConsultCompleted, name: "Consult Completed", order: 4, color: "#6366F1", rottingThresholdHours: 48 },
    { id: sQuoteSent, name: "Quote Sent", order: 5, color: "#F97316", rottingThresholdHours: 120 },
    { id: sExpiringQuote, name: "Expiring Quote", order: 6, color: "#EF4444", rottingThresholdHours: 24 },
    { id: sSurgeryBooked, name: "Surgery Booked", order: 7, color: "#2563EB", isWon: true, rottingThresholdHours: 120 },
    { id: sPreOpComplete, name: "Pre-Op Complete", order: 8, color: "#7C3AED", rottingThresholdHours: 72 },
    { id: sPostOpRecall, name: "Post-Op / Recall", order: 9, color: "#059669", rottingThresholdHours: 336 },
  ];

  for (const s of nonSurgStages) {
    await prisma.pipelineStage.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        pipelineId: pipelineNonSurgId,
        name: s.name,
        order: s.order,
        color: s.color,
        rotDaysWarning: 5,
        rotDaysCritical: 10,
        rottingThresholdHours: s.rottingThresholdHours,
        isWon: (s as any).isWon || false,
        isLost: false,
      },
    });
  }

  for (const s of surgStages) {
    await prisma.pipelineStage.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        pipelineId: pipelineSurgId,
        name: s.name,
        order: s.order,
        color: s.color,
        rotDaysWarning: 5,
        rotDaysCritical: 10,
        rottingThresholdHours: s.rottingThresholdHours,
        isWon: (s as any).isWon || false,
        isLost: false,
      },
    });
  }

  // ─── PROCEDURES ───────────────────────────────────────────────────────────────
  console.log("Creating procedures...");
  const proceduresData = [
    { id: procBotox, name: "Botox", category: "Injectables", defaultDuration: 30, retailPrice: 450, floorPrice: 350 },
    { id: procFillers, name: "Dermal Fillers", category: "Injectables", defaultDuration: 45, retailPrice: 750, floorPrice: 600 },
    { id: procChemPeel, name: "Chemical Peel", category: "Skin Treatments", defaultDuration: 30, retailPrice: 250, floorPrice: 180 },
    { id: procHydrafacial, name: "Hydrafacial", category: "Skin Treatments", defaultDuration: 60, retailPrice: 350, floorPrice: 250 },
    { id: procLaser, name: "Laser Resurfacing", category: "Skin Treatments", defaultDuration: 90, retailPrice: 1200, floorPrice: 900 },
    { id: procMicroneedling, name: "Microneedling", category: "Skin Treatments", defaultDuration: 45, retailPrice: 400, floorPrice: 300 },
    { id: procRhino, name: "Rhinoplasty", category: "Surgical", defaultDuration: 180, retailPrice: 8500, floorPrice: 7000 },
    { id: procBreast, name: "Breast Augmentation", category: "Surgical", defaultDuration: 120, retailPrice: 7500, floorPrice: 6000 },
    { id: procFacelift, name: "Facelift", category: "Surgical", defaultDuration: 240, retailPrice: 15000, floorPrice: 12000 },
    { id: procBleph, name: "Blepharoplasty", category: "Surgical", defaultDuration: 90, retailPrice: 4500, floorPrice: 3500 },
    { id: procTummy, name: "Tummy Tuck", category: "Surgical", defaultDuration: 180, retailPrice: 9000, floorPrice: 7200 },
    { id: procMommy, name: "Mommy Makeover", category: "Surgical", defaultDuration: 300, retailPrice: 18000, floorPrice: 14500 },
  ];

  for (const p of proceduresData) {
    await prisma.procedure.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, practiceId },
    });
  }

  // ─── PATIENTS ─────────────────────────────────────────────────────────────────
  console.log("Creating patients...");
  const patientsData = [
    {
      id: patMaria, firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@email.com", phone: "(305) 555-1001",
      dateOfBirth: new Date("1985-03-15"), gender: "Female", address: "456 Ocean Dr", city: "Miami Beach", state: "FL", zip: "33139",
      referralSource: "Instagram Organic", status: "VIP" as const, isVip: true, vipAlias: "La Estrella", tags: ["VIP", "High Value"],
    },
    {
      id: patJames, firstName: "James", lastName: "Thompson", email: "james.thompson@email.com", phone: "(305) 555-1002",
      dateOfBirth: new Date("1978-07-22"), gender: "Male", address: "789 Collins Ave", city: "Miami Beach", state: "FL", zip: "33140",
      referralSource: "Google Ads", status: "ACTIVE" as const, tags: ["Surgical Candidate"],
    },
    {
      id: patCamila, firstName: "Camila", lastName: "Rodriguez", email: "camila.rod@email.com", phone: "(305) 555-1003",
      dateOfBirth: new Date("1992-11-08"), gender: "Female", address: "1100 Brickell Bay Dr", city: "Miami", state: "FL", zip: "33131",
      referralSource: "Word of Mouth", status: "ACTIVE" as const, tags: ["High Value"],
    },
    {
      id: patDavid, firstName: "David", lastName: "Chen", email: "david.chen@email.com", phone: "(305) 555-1004",
      dateOfBirth: new Date("1990-01-30"), gender: "Male", address: "200 S Biscayne Blvd", city: "Miami", state: "FL", zip: "33131",
      referralSource: "Website", status: "LEAD" as const, tags: ["Recall Priority"],
    },
    {
      id: patIsabella, firstName: "Isabella", lastName: "Martinez", email: "isabella.m@email.com", phone: "(305) 555-1005",
      dateOfBirth: new Date("1988-06-12"), gender: "Female", address: "3400 SW 27th Ave", city: "Coconut Grove", state: "FL", zip: "33133",
      referralSource: "Facebook Ads", status: "VIP" as const, isVip: true, vipAlias: "Diamond Client", tags: ["VIP", "Financing Needed"],
    },
    {
      id: patRobert, firstName: "Robert", lastName: "Williams", email: "robert.w@email.com", phone: "(305) 555-1006",
      dateOfBirth: new Date("1975-09-05"), gender: "Male", address: "500 Brickell Key Dr", city: "Miami", state: "FL", zip: "33131",
      referralSource: "Referral", status: "ACTIVE" as const, tags: ["Financing Needed"],
    },
    {
      id: patValentina, firstName: "Valentina", lastName: "Perez", email: "val.perez@email.com", phone: "(305) 555-1007",
      dateOfBirth: new Date("1995-04-20"), gender: "Female", address: "150 SE 3rd Ave", city: "Miami", state: "FL", zip: "33131",
      referralSource: "Instagram Organic", status: "ACTIVE" as const, tags: ["VIP"],
    },
    {
      id: patMichael, firstName: "Michael", lastName: "Johnson", email: "michael.j@email.com", phone: "(305) 555-1008",
      dateOfBirth: new Date("1982-12-18"), gender: "Male", address: "900 Biscayne Blvd", city: "Miami", state: "FL", zip: "33132",
      referralSource: "Google Ads", status: "INACTIVE" as const, tags: ["Discharged"],
    },
    {
      id: patLucia, firstName: "Lucia", lastName: "Fernandez", email: "lucia.f@email.com", phone: "(305) 555-1009",
      dateOfBirth: new Date("1998-08-25"), gender: "Female", address: "2000 N Bayshore Dr", city: "Miami", state: "FL", zip: "33137",
      referralSource: "Walk-In", status: "LEAD" as const, tags: ["Recall Priority"],
    },
    {
      id: patAlex, firstName: "Alex", lastName: "Rivera", email: "alex.rivera@email.com", phone: "(305) 555-1010",
      dateOfBirth: new Date("1993-02-14"), gender: "Non-binary", address: "350 NE 24th St", city: "Miami", state: "FL", zip: "33137",
      referralSource: "Website", status: "ACTIVE" as const, tags: ["High Value"],
    },
    {
      id: patNatalia, firstName: "Natalia", lastName: "Vargas", email: "natalia.v@email.com", phone: "(305) 555-1011",
      dateOfBirth: new Date("1980-10-03"), gender: "Female", address: "1000 S Miami Ave", city: "Miami", state: "FL", zip: "33130",
      referralSource: "Word of Mouth", status: "ACTIVE" as const, referredByPatientId: patMaria, tags: ["Recall Priority"],
    },
    {
      id: patCarlos, firstName: "Carlos", lastName: "Ramirez", email: "carlos.r@email.com", phone: "(305) 555-1012",
      dateOfBirth: new Date("1970-05-28"), gender: "Male", address: "600 NE 36th St", city: "Miami", state: "FL", zip: "33137",
      referralSource: "Referral", status: "FLAGGED" as const, tags: ["PITA"],
      notes: "Payment dispute on last visit. Follow up required.",
    },
    {
      id: patEmily, firstName: "Emily", lastName: "Park", email: "emily.park@email.com", phone: "(305) 555-1013",
      dateOfBirth: new Date("1987-07-14"), gender: "Female", address: "250 Catalonia Ave", city: "Coral Gables", state: "FL", zip: "33134",
      referralSource: "Instagram Organic", status: "ACTIVE" as const, tags: ["Financing Needed"],
    },
    {
      id: patSophie, firstName: "Sophie", lastName: "Ramirez", email: "sophie.r@email.com", phone: "(305) 555-1014",
      dateOfBirth: new Date("2010-09-10"), gender: "Female", address: "600 NE 36th St", city: "Miami", state: "FL", zip: "33137",
      referralSource: "Existing Patient Referral", status: "LEAD" as const, isMinor: true, parentGuardianId: patCarlos, tags: ["Surgical Candidate"],
    },
    {
      id: patDaniel, firstName: "Daniel", lastName: "Ortiz", email: "daniel.o@email.com", phone: "(305) 555-1015",
      dateOfBirth: new Date("1991-03-22"), gender: "Male", address: "800 S Dixie Hwy", city: "Coral Gables", state: "FL", zip: "33146",
      referralSource: "Google Ads", status: "LEAD" as const, tags: ["Recall Priority"],
    },
  ];

  for (const p of patientsData) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, practiceId, photoConsentStatus: "NONE" },
    });
  }

  // ─── OPPORTUNITIES ────────────────────────────────────────────────────────────
  console.log("Creating opportunities...");

  const today = new Date("2026-02-22");
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  const daysFromNow = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  const opportunitiesData = [
    // Non-Surgical pipeline - various stages
    { id: "opp_1", patientId: patMaria, pipelineId: pipelineNonSurgId, stageId: nsDepositPaid, assignedToId: userCarlosId, title: "Botox Treatment - Maria", value: 450, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(1), isWon: true, wonAt: daysAgo(5) },
    { id: "opp_2", patientId: patCamila, pipelineId: pipelineNonSurgId, stageId: nsConsultCompleted, assignedToId: userCarlosId, title: "Dermal Fillers - Camila", value: 750, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(2) },
    { id: "opp_3", patientId: patDavid, pipelineId: pipelineNonSurgId, stageId: nsNewInquiry, assignedToId: userAmandaId, title: "Hydrafacial Inquiry - David", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(8) },
    { id: "opp_4", patientId: patValentina, pipelineId: pipelineNonSurgId, stageId: nsQuoteSent, assignedToId: userCarlosId, title: "Laser Resurfacing - Valentina", value: 1200, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(9) },
    { id: "opp_5", patientId: patAlex, pipelineId: pipelineNonSurgId, stageId: nsConsultBooked, assignedToId: userAmandaId, title: "Chemical Peel - Alex", value: 250, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(1) },
    { id: "opp_6", patientId: patLucia, pipelineId: pipelineNonSurgId, stageId: nsNewInquiry, assignedToId: userCarlosId, title: "Microneedling - Lucia", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(16) },
    { id: "opp_7", patientId: patMaria, pipelineId: pipelineNonSurgId, stageId: nsDepositPaid, assignedToId: userCarlosId, title: "Botox Touch-up - Maria", value: 450, conversionType: "UPSELL" as const, lastActivityAt: daysAgo(0), isWon: true, wonAt: daysAgo(3) },
    { id: "opp_8", patientId: patJames, pipelineId: pipelineNonSurgId, stageId: nsConsultBooked, assignedToId: userAmandaId, title: "Botox - James", value: 450, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(10) },
    { id: "opp_9", patientId: patNatalia, pipelineId: pipelineNonSurgId, stageId: nsQuoteSent, assignedToId: userCarlosId, title: "Hydrafacial Package - Natalia", value: 1050, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(3) },
    { id: "opp_10", patientId: patRobert, pipelineId: pipelineNonSurgId, stageId: nsConsultCompleted, assignedToId: userSofiaId, title: "Laser Treatment - Robert", value: 1200, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(15) },
    { id: "opp_11", patientId: patMichael, pipelineId: pipelineNonSurgId, stageId: nsTreatmentComplete, assignedToId: userAmandaId, title: "Botox Recall - Michael", value: 450, conversionType: "UPSELL" as const, lastActivityAt: daysAgo(20) },
    { id: "opp_12", patientId: patDaniel, pipelineId: pipelineNonSurgId, stageId: nsNewInquiry, assignedToId: userCarlosId, title: "Dermal Fillers Inquiry - Daniel", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(2) },
    { id: "opp_13", patientId: patCamila, pipelineId: pipelineNonSurgId, stageId: nsDepositPaid, assignedToId: userSofiaId, title: "Microneedling - Camila", value: 400, conversionType: "UPSELL" as const, lastActivityAt: daysAgo(1), isWon: true, wonAt: daysAgo(2) },

    // Surgical pipeline - various stages
    { id: "opp_14", patientId: patIsabella, pipelineId: pipelineSurgId, stageId: sSurgeryBooked, assignedToId: userSofiaId, title: "Rhinoplasty - Isabella", value: 8500, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(1), isWon: true, wonAt: daysAgo(7) },
    { id: "opp_15", patientId: patEmily, pipelineId: pipelineSurgId, stageId: sConsultCompleted, assignedToId: userSofiaId, title: "Mommy Makeover - Emily", value: 18000, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(3) },
    { id: "opp_16", patientId: patJames, pipelineId: pipelineSurgId, stageId: sNewInquiry, assignedToId: userAmandaId, title: "Blepharoplasty Inquiry - James", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(18) },
    { id: "opp_17", patientId: patRobert, pipelineId: pipelineSurgId, stageId: sQuoteSent, assignedToId: userCarlosId, title: "Facelift - Robert", value: 15000, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(6) },
    { id: "opp_18", patientId: patNatalia, pipelineId: pipelineSurgId, stageId: sConsultBooked, assignedToId: userAmandaId, title: "Breast Augmentation - Natalia", value: 7500, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(2) },
    { id: "opp_19", patientId: patMaria, pipelineId: pipelineSurgId, stageId: sPreOpComplete, assignedToId: userSofiaId, title: "Blepharoplasty - Maria", value: 4500, conversionType: "UPSELL" as const, lastActivityAt: daysAgo(1) },
    { id: "opp_20", patientId: patIsabella, pipelineId: pipelineSurgId, stageId: sPostOpRecall, assignedToId: userSofiaId, title: "Tummy Tuck - Isabella", value: 9000, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(5) },
    { id: "opp_21", patientId: patCarlos, pipelineId: pipelineSurgId, stageId: sNewInquiry, assignedToId: userCarlosId, title: "Rhinoplasty Inquiry - Carlos R", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(12) },
    { id: "opp_22", patientId: patEmily, pipelineId: pipelineSurgId, stageId: sQuoteSent, assignedToId: userCarlosId, title: "Breast Augmentation - Emily", value: 7500, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(9) },
    { id: "opp_23", patientId: patValentina, pipelineId: pipelineSurgId, stageId: sConsultBooked, assignedToId: userAmandaId, title: "Tummy Tuck Consult - Valentina", value: 9000, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(4) },
    { id: "opp_24", patientId: patMichael, pipelineId: pipelineSurgId, stageId: sPostOpRecall, assignedToId: userAmandaId, title: "Facelift Recall - Michael", value: 15000, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(25) },
    { id: "opp_25", patientId: patDavid, pipelineId: pipelineSurgId, stageId: sConsultCompleted, assignedToId: userSofiaId, title: "Blepharoplasty - David", value: 4500, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(7) },
    { id: "opp_26", patientId: patAlex, pipelineId: pipelineNonSurgId, stageId: nsConsultCompleted, assignedToId: userCarlosId, title: "Hydrafacial + Peel - Alex", value: 600, conversionType: "UPSELL" as const, lastActivityAt: daysAgo(0) },
    { id: "opp_27", patientId: patSophie, pipelineId: pipelineNonSurgId, stageId: nsNewInquiry, assignedToId: userAmandaId, title: "Chemical Peel Consult - Sophie", conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(4) },
    { id: "opp_28", patientId: patEmily, pipelineId: pipelineNonSurgId, stageId: nsQuoteSent, assignedToId: userCarlosId, title: "Chemical Peel Package - Emily", value: 750, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(5) },
    { id: "opp_29", patientId: patDaniel, pipelineId: pipelineSurgId, stageId: sQuoteSent, assignedToId: userAmandaId, title: "Blepharoplasty - Daniel", value: 4500, conversionType: "NET_NEW" as const, lastActivityAt: daysAgo(4) },
  ];

  for (const o of opportunitiesData) {
    await prisma.opportunity.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        practiceId,
        patientId: o.patientId,
        pipelineId: o.pipelineId,
        stageId: o.stageId,
        assignedToId: o.assignedToId,
        title: o.title,
        value: o.value ?? null,
        conversionType: o.conversionType,
        lastActivityAt: o.lastActivityAt,
        stageEnteredAt: o.lastActivityAt,
        lastStageMovedAt: o.lastActivityAt,
        isWon: o.isWon ?? false,
        wonAt: o.wonAt ?? null,
        createdAt: daysAgo(30),
      },
    });
  }

  // ─── OPPORTUNITY PROCEDURES (join table) ──────────────────────────────────────
  console.log("Creating opportunity procedure links...");
  const allProcedureTypes = await prisma.procedureType.findMany({ where: { practiceId } });
  const ptByName = (name: string) => allProcedureTypes.find((pt) => pt.name === name)?.id;

  const oppProcedureLinks: { opportunityId: string; procedureName: string }[] = [
    { opportunityId: "opp_1", procedureName: "Injectables" },
    { opportunityId: "opp_2", procedureName: "Injectables" },
    { opportunityId: "opp_3", procedureName: "Facials" },
    { opportunityId: "opp_4", procedureName: "Laser Skin Resurfacing" },
    { opportunityId: "opp_5", procedureName: "Chemical Peel" },
    { opportunityId: "opp_6", procedureName: "Facials" },
    { opportunityId: "opp_7", procedureName: "Injectables" },
    { opportunityId: "opp_8", procedureName: "Injectables" },
    { opportunityId: "opp_9", procedureName: "Facials" },
    { opportunityId: "opp_10", procedureName: "Laser Skin Resurfacing" },
    { opportunityId: "opp_11", procedureName: "Injectables" },
    { opportunityId: "opp_12", procedureName: "Injectables" },
    { opportunityId: "opp_13", procedureName: "Facials" },
    { opportunityId: "opp_14", procedureName: "Rhinoplasty" },
    { opportunityId: "opp_15", procedureName: "Tummy Tuck" },
    { opportunityId: "opp_15", procedureName: "Breast Lift" },
    { opportunityId: "opp_15", procedureName: "Liposuction" },
    { opportunityId: "opp_16", procedureName: "Blepharoplasty" },
    { opportunityId: "opp_17", procedureName: "Facelift" },
    { opportunityId: "opp_17", procedureName: "Neck Lift" },
    { opportunityId: "opp_18", procedureName: "Breast Augmentation" },
    { opportunityId: "opp_19", procedureName: "Blepharoplasty" },
    { opportunityId: "opp_20", procedureName: "Tummy Tuck" },
    { opportunityId: "opp_21", procedureName: "Rhinoplasty" },
    { opportunityId: "opp_22", procedureName: "Breast Augmentation" },
    { opportunityId: "opp_23", procedureName: "Tummy Tuck" },
    { opportunityId: "opp_24", procedureName: "Facelift" },
    { opportunityId: "opp_25", procedureName: "Blepharoplasty" },
    { opportunityId: "opp_26", procedureName: "Facials" },
    { opportunityId: "opp_26", procedureName: "Chemical Peel" },
    { opportunityId: "opp_27", procedureName: "Chemical Peel" },
    { opportunityId: "opp_28", procedureName: "Chemical Peel" },
    { opportunityId: "opp_29", procedureName: "Blepharoplasty" },
  ];

  for (const link of oppProcedureLinks) {
    const ptId = ptByName(link.procedureName);
    if (ptId) {
      await prisma.opportunityProcedure.create({
        data: { opportunityId: link.opportunityId, procedureTypeId: ptId },
      });
    }
  }

  // ─── CONFIGURED APPOINTMENT TYPES ─────────────────────────────────────────────
  console.log("Creating configured appointment types...");

  const appointmentTypesData = [
    { id: "cat_consultation", name: "Consultation", color: "#3B82F6", durationMins: 45, bufferMins: 10 },
    { id: "cat_followup", name: "Follow-Up", color: "#10B981", durationMins: 30, bufferMins: 5 },
    { id: "cat_procedure", name: "Procedure", color: "#8B5CF6", durationMins: 60, bufferMins: 15 },
    { id: "cat_treatment", name: "Treatment", color: "#14B8A6", durationMins: 30, bufferMins: 10 },
    { id: "cat_preop", name: "Pre-Op", color: "#F59E0B", durationMins: 30, bufferMins: 5 },
    { id: "cat_postop", name: "Post-Op", color: "#F97316", durationMins: 20, bufferMins: 5 },
  ];

  for (const at of appointmentTypesData) {
    await prisma.configuredAppointmentType.upsert({
      where: { id: at.id },
      update: {},
      create: { ...at, practiceId },
    });
  }

  // ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
  console.log("Creating appointments...");

  const mkAppt = (hours: number, mins: number, durationMins: number, baseDate: Date) => {
    const start = new Date(baseDate);
    start.setHours(hours, mins, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + durationMins);
    return { startTime: start, endTime: end };
  };

  const appointmentsData = [
    // Past appointments (completed, cancelled, no-show)
    { id: "appt_1", patientId: patMaria, opportunityId: "opp_1", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "TREATMENT" as const, title: "Botox - Maria G", ...mkAppt(10, 0, 30, daysAgo(25)), status: "COMPLETED" as const },
    { id: "appt_2", patientId: patJames, providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Initial Consult - James T", ...mkAppt(11, 0, 60, daysAgo(22)), status: "COMPLETED" as const },
    { id: "appt_3", patientId: patCamila, opportunityId: "opp_2", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Filler Consult - Camila R", ...mkAppt(14, 0, 45, daysAgo(20)), status: "COMPLETED" as const },
    { id: "appt_4", patientId: patIsabella, opportunityId: "opp_14", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Rhinoplasty Consult - Isabella M", ...mkAppt(9, 0, 60, daysAgo(18)), status: "COMPLETED" as const },
    { id: "appt_5", patientId: patMichael, providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "TREATMENT" as const, title: "Botox - Michael J", ...mkAppt(15, 0, 30, daysAgo(17)), status: "NO_SHOW" as const },
    { id: "appt_6", patientId: patRobert, opportunityId: "opp_10", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Laser Consult - Robert W", ...mkAppt(10, 30, 60, daysAgo(15)), status: "COMPLETED" as const },
    { id: "appt_7", patientId: patEmily, opportunityId: "opp_15", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Mommy Makeover Consult - Emily P", ...mkAppt(13, 0, 90, daysAgo(14)), status: "COMPLETED" as const },
    { id: "appt_8", patientId: patValentina, opportunityId: "opp_4", providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Laser Consult - Valentina P", ...mkAppt(11, 0, 45, daysAgo(12)), status: "COMPLETED" as const },
    { id: "appt_9", patientId: patNatalia, opportunityId: "opp_9", providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "TREATMENT" as const, title: "Hydrafacial - Natalia V", ...mkAppt(14, 30, 60, daysAgo(10)), status: "COMPLETED" as const },
    { id: "appt_10", patientId: patMaria, opportunityId: "opp_7", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "TREATMENT" as const, title: "Botox Touch-up - Maria G", ...mkAppt(9, 0, 30, daysAgo(8)), status: "COMPLETED" as const },
    { id: "appt_11", patientId: patDavid, opportunityId: "opp_3", providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Hydrafacial Consult - David C", ...mkAppt(16, 0, 30, daysAgo(7)), status: "CANCELLED" as const, cancelledAt: daysAgo(8), cancelReason: "Patient rescheduled" },
    { id: "appt_12", patientId: patIsabella, opportunityId: "opp_20", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "SURGERY" as const, title: "Tummy Tuck - Isabella M", ...mkAppt(7, 0, 180, daysAgo(6)), status: "COMPLETED" as const },
    { id: "appt_13", patientId: patAlex, opportunityId: "opp_5", providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Chemical Peel Consult - Alex R", ...mkAppt(10, 0, 30, daysAgo(5)), status: "COMPLETED" as const },
    { id: "appt_14", patientId: patCamila, opportunityId: "opp_13", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "TREATMENT" as const, title: "Microneedling - Camila R", ...mkAppt(13, 0, 45, daysAgo(4)), status: "COMPLETED" as const },
    { id: "appt_15", patientId: patIsabella, opportunityId: "opp_20", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "POST_OP" as const, title: "Post-Op Check - Isabella M", ...mkAppt(9, 0, 30, daysAgo(3)), status: "COMPLETED" as const },
    { id: "appt_16", patientId: patCarlos, providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Rhinoplasty Consult - Carlos R", ...mkAppt(15, 0, 60, daysAgo(2)), status: "COMPLETED" as const },
    { id: "appt_17", patientId: patMaria, opportunityId: "opp_19", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "FOLLOW_UP" as const, title: "Pre-Op Follow-up - Maria G", ...mkAppt(11, 0, 30, daysAgo(1)), status: "COMPLETED" as const },

    // Future appointments
    { id: "appt_18", patientId: patAlex, opportunityId: "opp_26", providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "TREATMENT" as const, title: "Hydrafacial + Peel - Alex R", ...mkAppt(10, 0, 90, daysFromNow(1)), status: "CONFIRMED" as const },
    { id: "appt_19", patientId: patNatalia, opportunityId: "opp_18", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Breast Aug Consult - Natalia V", ...mkAppt(14, 0, 60, daysFromNow(2)), status: "CONFIRMED" as const },
    { id: "appt_20", patientId: patDaniel, opportunityId: "opp_12", providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Filler Consult - Daniel O", ...mkAppt(11, 0, 45, daysFromNow(3)), status: "PENDING" as const },
    { id: "appt_21", patientId: patValentina, opportunityId: "opp_4", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "TREATMENT" as const, title: "Laser Resurfacing - Valentina P", ...mkAppt(9, 0, 90, daysFromNow(5)), status: "CONFIRMED" as const },
    { id: "appt_22", patientId: patRobert, opportunityId: "opp_17", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Facelift Consult Follow-up - Robert W", ...mkAppt(13, 0, 60, daysFromNow(6)), status: "CONFIRMED" as const },
    { id: "appt_23", patientId: patEmily, opportunityId: "opp_22", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Breast Aug Consult - Emily P", ...mkAppt(10, 0, 60, daysFromNow(7)), status: "PENDING" as const },
    { id: "appt_24", patientId: patIsabella, opportunityId: "opp_14", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "SURGERY" as const, title: "Rhinoplasty - Isabella M", ...mkAppt(7, 0, 180, daysFromNow(10)), status: "CONFIRMED" as const },
    { id: "appt_25", patientId: patMaria, opportunityId: "opp_19", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "SURGERY" as const, title: "Blepharoplasty - Maria G", ...mkAppt(8, 0, 90, daysFromNow(12)), status: "CONFIRMED" as const },
    { id: "appt_26", patientId: patCamila, providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "TREATMENT" as const, title: "Dermal Fillers - Camila R", ...mkAppt(14, 0, 45, daysFromNow(8)), status: "CONFIRMED" as const },
    { id: "appt_27", patientId: patJames, opportunityId: "opp_8", providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Botox Consult - James T", ...mkAppt(15, 0, 30, daysFromNow(4)), status: "PENDING" as const },
    { id: "appt_28", patientId: patLucia, opportunityId: "opp_6", providerId: userJessicaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Microneedling Consult - Lucia F", ...mkAppt(10, 0, 45, daysFromNow(9)), status: "PENDING" as const },
    { id: "appt_29", patientId: patValentina, opportunityId: "opp_23", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "CONSULT" as const, title: "Tummy Tuck Consult - Valentina P", ...mkAppt(11, 0, 60, daysFromNow(14)), status: "PENDING" as const },
    { id: "appt_30", patientId: patIsabella, opportunityId: "opp_20", providerId: userSofiaId, createdById: userPriyaId, appointmentCategory: "POST_OP" as const, title: "Post-Op Follow-up - Isabella M", ...mkAppt(9, 0, 30, daysFromNow(15)), status: "CONFIRMED" as const },
    { id: "appt_31", patientId: patDavid, opportunityId: "opp_25", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "CONSULT" as const, title: "Blepharoplasty Consult - David C", ...mkAppt(13, 0, 60, daysFromNow(11)), status: "CONFIRMED" as const },
    { id: "appt_32", patientId: patMaria, providerId: userJessicaId, createdById: userPriyaId, appointmentCategory: "FOLLOW_UP" as const, title: "Post-Op Follow-up - Maria G", ...mkAppt(10, 0, 30, daysFromNow(20)), status: "PENDING" as const },
    { id: "appt_33", patientId: patEmily, opportunityId: "opp_15", providerId: userSofiaId, createdById: userCarlosId, appointmentCategory: "SURGERY" as const, title: "Mommy Makeover - Emily P", ...mkAppt(7, 0, 300, daysFromNow(25)), status: "PENDING" as const },
  ];

  for (const a of appointmentsData) {
    await prisma.appointment.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        practiceId,
        patientId: a.patientId,
        opportunityId: a.opportunityId ?? null,
        providerId: a.providerId,
        createdById: a.createdById,
        appointmentCategory: a.appointmentCategory,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        cancelledAt: (a as any).cancelledAt ?? null,
        cancelReason: (a as any).cancelReason ?? null,
      },
    });
  }

  // ─── ACTIVITIES ───────────────────────────────────────────────────────────────
  console.log("Creating activities...");

  const activitiesData = [
    { id: "act_1", patientId: patMaria, userId: userCarlosId, type: "NOTE" as const, body: "Patient interested in Botox for crow's feet. Scheduled initial consultation.", createdAt: daysAgo(28) },
    { id: "act_2", patientId: patMaria, userId: userSofiaId, type: "STAGE_CHANGE" as const, body: "Moved from Consult Completed to Booked", metadata: { from: "Consult Completed", to: "Booked" }, createdAt: daysAgo(26) },
    { id: "act_3", patientId: patCamila, userId: userCarlosId, type: "CALL" as const, body: "Called patient to discuss filler options. Very interested in lip augmentation.", createdAt: daysAgo(22) },
    { id: "act_4", patientId: patIsabella, userId: userSofiaId, type: "NOTE" as const, body: "VIP patient - prefers private entrance and extended consultation time.", createdAt: daysAgo(20) },
    { id: "act_5", patientId: patDavid, userId: userAmandaId, type: "EMAIL" as const, body: "Sent welcome email with practice information and consultation booking link.", createdAt: daysAgo(18) },
    { id: "act_6", patientId: patEmily, userId: userSofiaId, type: "NOTE" as const, body: "Discussed mommy makeover options. Patient interested in combined breast aug and tummy tuck.", createdAt: daysAgo(15) },
    { id: "act_7", patientId: patRobert, userId: userSofiaId, type: "STAGE_CHANGE" as const, body: "Moved from Consult Booked to Consult Completed", metadata: { from: "Consult Booked", to: "Consult Completed" }, createdAt: daysAgo(15) },
    { id: "act_8", patientId: patValentina, userId: userJessicaId, type: "NOTE" as const, body: "Patient is a local influencer. Discussed laser resurfacing for acne scarring.", createdAt: daysAgo(12) },
    { id: "act_9", patientId: patNatalia, userId: userCarlosId, type: "CALL" as const, body: "Follow-up call after hydrafacial. Patient very happy with results, interested in package deal.", createdAt: daysAgo(10) },
    { id: "act_10", patientId: patMichael, userId: userAmandaId, type: "EMAIL" as const, body: "Sent recall email for Botox touch-up. Last treatment was 4 months ago.", createdAt: daysAgo(20) },
    { id: "act_11", patientId: patAlex, userId: userJessicaId, type: "NOTE" as const, body: "Chemical peel consult completed. Recommended series of 3 treatments.", createdAt: daysAgo(5) },
    { id: "act_12", patientId: patCarlos, userId: userAmandaId, type: "NOTE" as const, body: "Payment dispute flagged. Patient claims overcharge on last visit. Manager reviewing.", createdAt: daysAgo(8), isInternal: true },
    { id: "act_13", patientId: patIsabella, userId: userSofiaId, type: "STAGE_CHANGE" as const, body: "Moved from Post-Op to Recovery monitoring", metadata: { from: "Surgery Booked", to: "Post-Op" }, createdAt: daysAgo(5) },
    { id: "act_14", patientId: patLucia, userId: userCarlosId, type: "SMS" as const, body: "Texted patient to follow up on microneedling inquiry. No response yet.", createdAt: daysAgo(14) },
    { id: "act_15", patientId: patMaria, userId: userPriyaId, type: "APPOINTMENT" as const, body: "Pre-op appointment confirmed for blepharoplasty preparation.", createdAt: daysAgo(2) },
    { id: "act_16", patientId: patJames, userId: userAmandaId, type: "CALL" as const, body: "Called to reschedule consultation. Patient requested next available slot.", createdAt: daysAgo(10) },
    { id: "act_17", patientId: patDaniel, userId: userCarlosId, type: "EMAIL" as const, body: "Sent consultation confirmation and pre-visit questionnaire.", createdAt: daysAgo(2) },
    { id: "act_18", patientId: patSophie, userId: userAmandaId, type: "NOTE" as const, body: "Minor patient - parent Carlos Ramirez must be present for all consultations.", createdAt: daysAgo(4) },
    { id: "act_19", patientId: patCamila, userId: userSofiaId, type: "STAGE_CHANGE" as const, body: "Moved from Quote Sent to Booked for microneedling", metadata: { from: "Quote Sent", to: "Booked" }, createdAt: daysAgo(3) },
    { id: "act_20", patientId: patNatalia, userId: userCarlosId, type: "NOTE" as const, body: "Patient referred by Maria Gonzalez. Offered referral discount.", createdAt: daysAgo(25) },
    { id: "act_21", patientId: patEmily, userId: userCarlosId, type: "CALL" as const, body: "Discussed financing options for mommy makeover. Patient interested in CareCredit.", createdAt: daysAgo(7) },
    { id: "act_22", patientId: patValentina, userId: userCarlosId, type: "STAGE_CHANGE" as const, body: "Moved from Consult Completed to Quote Sent", metadata: { from: "Consult Completed", to: "Quote Sent" }, createdAt: daysAgo(9) },
  ];

  for (const a of activitiesData) {
    await prisma.activity.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        practiceId,
        patientId: a.patientId,
        userId: a.userId,
        type: a.type,
        body: a.body,
        metadata: (a as any).metadata ?? null,
        isInternal: (a as any).isInternal ?? false,
        createdAt: a.createdAt,
      },
    });
  }

  // ─── QUOTES ───────────────────────────────────────────────────────────────────
  console.log("Creating quotes...");

  const quotesData = [
    {
      id: "quote_1", quoteNumber: "Q-2026-0001", patientId: patCamila, opportunityId: "opp_2", coordinatorId: userCarlosId, status: "SENT" as const,
      subtotal: 750, discountAmount: 0, taxAmount: 0, total: 750, sentAt: daysAgo(18), expirationDate: daysFromNow(12),
      lineItems: [
        { id: "qli_1", name: "Dermal Fillers - Lips", description: "Dermal Fillers - Lips", quantity: 1, unitPrice: 750, providerId: userSofiaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_2", quoteNumber: "Q-2026-0002", patientId: patValentina, opportunityId: "opp_4", coordinatorId: userCarlosId, status: "SENT" as const,
      subtotal: 1200, discountAmount: 100, taxAmount: 0, total: 1100, sentAt: daysAgo(9), expirationDate: daysFromNow(21),
      internalNotes: "Influencer discount applied",
      quoteLevelDiscountType: "FIXED" as const, quoteLevelDiscountValue: 100,
      lineItems: [
        { id: "qli_2", name: "Laser Resurfacing - Full Face", description: "Laser Resurfacing - Full Face", quantity: 1, unitPrice: 1200, providerId: userJessicaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_3", quoteNumber: "Q-2026-0003", patientId: patIsabella, opportunityId: "opp_14", coordinatorId: userSofiaId, status: "ACCEPTED" as const,
      subtotal: 8500, discountAmount: 500, taxAmount: 0, total: 8000, sentAt: daysAgo(14), acceptedAt: daysAgo(10), expirationDate: daysFromNow(16),
      internalNotes: "VIP discount applied",
      quoteLevelDiscountType: "FIXED" as const, quoteLevelDiscountValue: 500,
      lineItems: [
        { id: "qli_3", name: "Rhinoplasty", description: "Rhinoplasty", quantity: 1, unitPrice: 8500, providerId: userSofiaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_4", quoteNumber: "Q-2026-0004", patientId: patEmily, opportunityId: "opp_15", coordinatorId: userSofiaId, status: "DRAFT" as const,
      subtotal: 25500, discountAmount: 2000, taxAmount: 0, total: 23500,
      quoteLevelDiscountType: "FIXED" as const, quoteLevelDiscountValue: 2000,
      lineItems: [
        { id: "qli_4", name: "Breast Augmentation", description: "Breast Augmentation", quantity: 1, unitPrice: 7500, providerId: userSofiaId, sortOrder: 0 },
        { id: "qli_5", name: "Tummy Tuck", description: "Tummy Tuck", quantity: 1, unitPrice: 9000, providerId: userSofiaId, sortOrder: 1 },
        { id: "qli_6", name: "Mommy Makeover Package", description: "Mommy Makeover Package Coordination", quantity: 1, unitPrice: 9000, providerId: userSofiaId, sortOrder: 2 },
      ],
    },
    {
      id: "quote_5", quoteNumber: "Q-2026-0005", patientId: patRobert, opportunityId: "opp_17", coordinatorId: userCarlosId, status: "SENT" as const,
      subtotal: 15000, discountAmount: 0, taxAmount: 0, total: 15000, sentAt: daysAgo(6), expirationDate: daysFromNow(24),
      lineItems: [
        { id: "qli_7", name: "Full Facelift", description: "Full Facelift", quantity: 1, unitPrice: 15000, providerId: userSofiaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_6", quoteNumber: "Q-2026-0006", patientId: patNatalia, opportunityId: "opp_9", coordinatorId: userCarlosId, status: "ACCEPTED" as const,
      subtotal: 1050, discountAmount: 50, taxAmount: 0, total: 1000, sentAt: daysAgo(8), acceptedAt: daysAgo(5), expirationDate: daysFromNow(22),
      internalNotes: "Package of 3 hydrafacials",
      quoteLevelDiscountType: "FIXED" as const, quoteLevelDiscountValue: 50,
      lineItems: [
        { id: "qli_8", name: "Hydrafacial - Session 1", description: "Hydrafacial - Session 1", quantity: 1, unitPrice: 350, providerId: userJessicaId, sortOrder: 0 },
        { id: "qli_9", name: "Hydrafacial - Session 2", description: "Hydrafacial - Session 2", quantity: 1, unitPrice: 350, providerId: userJessicaId, sortOrder: 1 },
        { id: "qli_10", name: "Hydrafacial - Session 3", description: "Hydrafacial - Session 3", quantity: 1, unitPrice: 350, providerId: userJessicaId, sortOrder: 2 },
      ],
    },
    {
      id: "quote_7", quoteNumber: "Q-2026-0007", patientId: patMaria, opportunityId: "opp_19", coordinatorId: userSofiaId, status: "ACCEPTED" as const,
      subtotal: 4500, discountAmount: 300, taxAmount: 0, total: 4200, sentAt: daysAgo(10), acceptedAt: daysAgo(7), expirationDate: daysFromNow(20),
      internalNotes: "VIP loyalty discount",
      quoteLevelDiscountType: "FIXED" as const, quoteLevelDiscountValue: 300,
      lineItems: [
        { id: "qli_11", name: "Blepharoplasty - Upper Lids", description: "Blepharoplasty - Upper Lids", quantity: 1, unitPrice: 4500, providerId: userSofiaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_8", quoteNumber: "Q-2026-0008", patientId: patMichael, opportunityId: "opp_11", coordinatorId: userAmandaId, status: "EXPIRED" as const,
      subtotal: 450, discountAmount: 0, taxAmount: 0, total: 450, sentAt: daysAgo(30), expirationDate: daysAgo(1),
      lineItems: [
        { id: "qli_12", name: "Botox - Forehead", description: "Botox - Forehead", quantity: 1, unitPrice: 450, providerId: userJessicaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_9", quoteNumber: "Q-2026-0009", patientId: patEmily, opportunityId: "opp_28", coordinatorId: userCarlosId, status: "SENT" as const,
      subtotal: 750, discountAmount: 0, taxAmount: 0, total: 750, sentAt: daysAgo(25), expirationDate: daysFromNow(10),
      lineItems: [
        { id: "qli_13", name: "Chemical Peel Package", description: "Chemical Peel Package - 3 Sessions", quantity: 3, unitPrice: 250, providerId: userJessicaId, sortOrder: 0 },
      ],
    },
    {
      id: "quote_10", quoteNumber: "Q-2026-0010", patientId: patDaniel, opportunityId: "opp_29", coordinatorId: userAmandaId, status: "SENT" as const,
      subtotal: 4500, discountAmount: 0, taxAmount: 0, total: 4500, sentAt: daysAgo(20), expirationDate: daysFromNow(8),
      lineItems: [
        { id: "qli_14", name: "Blepharoplasty", description: "Blepharoplasty", quantity: 1, unitPrice: 4500, providerId: userSofiaId, sortOrder: 0 },
      ],
    },
  ];

  for (const q of quotesData) {
    const { lineItems, ...quoteData } = q;
    await prisma.quote.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: quoteData.id,
        quoteNumber: quoteData.quoteNumber,
        practiceId,
        patientId: quoteData.patientId,
        opportunityId: quoteData.opportunityId,
        coordinatorId: quoteData.coordinatorId,
        status: quoteData.status,
        subtotal: quoteData.subtotal,
        discountAmount: quoteData.discountAmount,
        taxAmount: quoteData.taxAmount,
        total: quoteData.total,
        sentAt: quoteData.sentAt ?? null,
        acceptedAt: (quoteData as any).acceptedAt ?? null,
        expirationDate: quoteData.expirationDate ?? null,
        internalNotes: (quoteData as any).internalNotes ?? null,
        quoteLevelDiscountType: (quoteData as any).quoteLevelDiscountType ?? null,
        quoteLevelDiscountValue: (quoteData as any).quoteLevelDiscountValue ?? null,
      },
    });

    for (const li of lineItems) {
      await prisma.quoteLineItem.upsert({
        where: { id: li.id },
        update: {},
        create: {
          id: li.id,
          quoteId: q.id,
          name: li.name,
          description: li.description ?? null,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          providerId: li.providerId ?? null,
          sortOrder: li.sortOrder,
        },
      });
    }
  }

  // ─── TREATMENT PLANS ──────────────────────────────────────────────────────────
  console.log("Creating treatment plans...");

  const treatmentPlansData = [
    {
      id: "tp_1", patientId: patMaria, createdById: userSofiaId, title: "Botox Maintenance Plan",
      status: "ACTIVE" as const, startDate: daysAgo(60), notes: "Quarterly Botox treatments for forehead and crow's feet",
      items: [
        { id: "tpi_1", procedureId: procBotox, description: "Botox - Forehead Lines", frequency: "Every 3 months", recommendedIntervalDays: 90, completedSessions: 2, totalSessions: 4, order: 0 },
        { id: "tpi_2", procedureId: procBotox, description: "Botox - Crow's Feet", frequency: "Every 3 months", recommendedIntervalDays: 90, completedSessions: 2, totalSessions: 4, order: 1 },
      ],
    },
    {
      id: "tp_2", patientId: patCamila, createdById: userSofiaId, title: "Dermal Filler Enhancement Plan",
      status: "ACTIVE" as const, startDate: daysAgo(30), notes: "Lip and cheek augmentation series",
      items: [
        { id: "tpi_3", procedureId: procFillers, description: "Lip Filler - Juvederm", frequency: "Every 6 months", recommendedIntervalDays: 180, completedSessions: 1, totalSessions: 2, order: 0 },
        { id: "tpi_4", procedureId: procFillers, description: "Cheek Filler - Voluma", frequency: "Every 12 months", recommendedIntervalDays: 365, completedSessions: 0, totalSessions: 1, order: 1 },
        { id: "tpi_5", procedureId: procMicroneedling, description: "Microneedling - Skin Prep", frequency: "Monthly x3", recommendedIntervalDays: 30, completedSessions: 1, totalSessions: 3, order: 2 },
      ],
    },
    {
      id: "tp_3", patientId: patAlex, createdById: userJessicaId, title: "Skin Rejuvenation Program",
      status: "ACTIVE" as const, startDate: daysAgo(10), notes: "Chemical peel series with hydrafacial maintenance",
      items: [
        { id: "tpi_6", procedureId: procChemPeel, description: "Chemical Peel - Light", frequency: "Every 4 weeks", recommendedIntervalDays: 28, completedSessions: 0, totalSessions: 3, order: 0 },
        { id: "tpi_7", procedureId: procHydrafacial, description: "Hydrafacial - Maintenance", frequency: "Monthly", recommendedIntervalDays: 30, completedSessions: 0, totalSessions: 6, order: 1 },
      ],
    },
    {
      id: "tp_4", patientId: patIsabella, createdById: userSofiaId, title: "Surgical Recovery & Maintenance",
      status: "ACTIVE" as const, startDate: daysAgo(6), notes: "Post-tummy tuck recovery and future rhinoplasty prep",
      items: [
        { id: "tpi_8", description: "Post-Op Follow-up Visits", frequency: "Weekly x4", recommendedIntervalDays: 7, completedSessions: 1, totalSessions: 4, order: 0 },
        { id: "tpi_9", procedureId: procRhino, description: "Rhinoplasty - Scheduled", frequency: "One-time", completedSessions: 0, totalSessions: 1, order: 1 },
        { id: "tpi_10", procedureId: procBotox, description: "Botox Touch-up - Post Recovery", frequency: "As needed", completedSessions: 0, totalSessions: 2, order: 2 },
      ],
    },
    {
      id: "tp_5", patientId: patNatalia, createdById: userJessicaId, title: "Hydrafacial Package Plan",
      status: "ACTIVE" as const, startDate: daysAgo(10), notes: "3-session hydrafacial package with home care",
      items: [
        { id: "tpi_11", procedureId: procHydrafacial, description: "Hydrafacial - Deep Cleanse", frequency: "Monthly x3", recommendedIntervalDays: 30, completedSessions: 1, totalSessions: 3, lastPerformedAt: daysAgo(10), nextDueAt: daysFromNow(20), order: 0 },
        { id: "tpi_12", procedureId: procChemPeel, description: "Light Chemical Peel - Follow-up", frequency: "After hydrafacial series", completedSessions: 0, totalSessions: 1, order: 1 },
      ],
    },
  ];

  for (const tp of treatmentPlansData) {
    const { items, ...planData } = tp;
    await prisma.treatmentPlan.upsert({
      where: { id: tp.id },
      update: {},
      create: {
        id: planData.id,
        practiceId,
        patientId: planData.patientId,
        createdById: planData.createdById,
        title: planData.title,
        status: planData.status,
        startDate: planData.startDate,
        notes: planData.notes ?? null,
      },
    });

    for (const item of items) {
      await prisma.treatmentPlanItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          treatmentPlanId: tp.id,
          procedureId: (item as any).procedureId ?? null,
          description: item.description,
          frequency: item.frequency ?? null,
          recommendedIntervalDays: (item as any).recommendedIntervalDays ?? null,
          completedSessions: item.completedSessions,
          totalSessions: item.totalSessions,
          lastPerformedAt: (item as any).lastPerformedAt ?? null,
          nextDueAt: (item as any).nextDueAt ?? null,
          order: item.order,
        },
      });
    }
  }

  // ─── OPPORTUNITY FORMS ──────────────────────────────────────────────────────
  console.log("Creating opportunity forms...");

  const formsData = [
    { id: "form_1", opportunityId: "opp_14", formName: "Medical History", status: "COMPLETED", sentAt: daysAgo(20), completedAt: daysAgo(18) },
    { id: "form_2", opportunityId: "opp_14", formName: "Surgical Consent", status: "COMPLETED", sentAt: daysAgo(15), completedAt: daysAgo(14) },
    { id: "form_3", opportunityId: "opp_14", formName: "Photo Consent", status: "COMPLETED", sentAt: daysAgo(15), completedAt: daysAgo(14) },
    { id: "form_4", opportunityId: "opp_15", formName: "Medical History", status: "SENT", sentAt: daysAgo(5) },
    { id: "form_5", opportunityId: "opp_15", formName: "Surgical Consent", status: "NOT_SENT" },
    { id: "form_6", opportunityId: "opp_19", formName: "Medical History", status: "COMPLETED", sentAt: daysAgo(8), completedAt: daysAgo(6) },
    { id: "form_7", opportunityId: "opp_19", formName: "Surgical Consent", status: "COMPLETED", sentAt: daysAgo(8), completedAt: daysAgo(5) },
    { id: "form_8", opportunityId: "opp_19", formName: "Photo Consent", status: "SENT", sentAt: daysAgo(4) },
    { id: "form_9", opportunityId: "opp_17", formName: "Medical History", status: "SENT", sentAt: daysAgo(6) },
    { id: "form_10", opportunityId: "opp_20", formName: "Medical History", status: "COMPLETED", sentAt: daysAgo(12), completedAt: daysAgo(10) },
    { id: "form_11", opportunityId: "opp_20", formName: "Surgical Consent", status: "COMPLETED", sentAt: daysAgo(12), completedAt: daysAgo(10) },
    { id: "form_12", opportunityId: "opp_2", formName: "Treatment Consent", status: "SENT", sentAt: daysAgo(3) },
  ];

  for (const f of formsData) {
    await prisma.opportunityForm.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        opportunityId: f.opportunityId,
        formName: f.formName,
        status: f.status,
        sentAt: f.sentAt ?? null,
        completedAt: f.completedAt ?? null,
      },
    });
  }

  // ─── INVOICES & PAYMENTS ────────────────────────────────────────────────────
  console.log("Creating invoices and payments...");

  const invoicesData = [
    {
      id: "inv_1", patientId: patMaria, opportunityId: "opp_1", quoteId: null, invoiceNumber: "INV-2026-001", description: "Botox Treatment",
      status: "PAID" as const, subtotal: 450, discountAmount: 0, total: 450, amountPaid: 450, balanceDue: 0,
      dueDate: daysAgo(20), paidAt: daysAgo(25), createdAt: daysAgo(25),
      payments: [
        { id: "pay_1", patientId: patMaria, amount: 450, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(25), reference: "ch_abc123" },
      ],
    },
    {
      id: "inv_2", patientId: patMaria, opportunityId: "opp_7", quoteId: null, invoiceNumber: "INV-2026-002", description: "Botox Touch-up",
      status: "PAID" as const, subtotal: 450, discountAmount: 50, total: 400, amountPaid: 400, balanceDue: 0,
      dueDate: daysAgo(3), paidAt: daysAgo(8), createdAt: daysAgo(8),
      payments: [
        { id: "pay_2", patientId: patMaria, amount: 400, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(8), reference: "ch_def456" },
      ],
    },
    {
      id: "inv_3", patientId: patIsabella, opportunityId: "opp_20", quoteId: null, invoiceNumber: "INV-2026-003", description: "Tummy Tuck",
      status: "PARTIAL" as const, subtotal: 9000, discountAmount: 500, total: 8500, amountPaid: 4250, balanceDue: 4250,
      dueDate: daysFromNow(10), createdAt: daysAgo(6),
      payments: [
        { id: "pay_3", patientId: patIsabella, amount: 4250, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(6), reference: "ch_ghi789" },
      ],
    },
    {
      id: "inv_4", patientId: patIsabella, opportunityId: "opp_14", quoteId: "quote_3", invoiceNumber: "INV-2026-004", description: "Rhinoplasty",
      status: "SENT" as const, subtotal: 8500, discountAmount: 500, total: 8000, amountPaid: 0, balanceDue: 8000,
      dueDate: daysFromNow(5), createdAt: daysAgo(3),
      payments: [],
    },
    {
      id: "inv_5", patientId: patNatalia, opportunityId: "opp_9", quoteId: "quote_6", invoiceNumber: "INV-2026-005", description: "Hydrafacial Package",
      status: "PAID" as const, subtotal: 1050, discountAmount: 50, total: 1000, amountPaid: 1000, balanceDue: 0,
      dueDate: daysAgo(1), paidAt: daysAgo(5), createdAt: daysAgo(8),
      payments: [
        { id: "pay_4", patientId: patNatalia, amount: 500, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(8), reference: "ch_jkl012" },
        { id: "pay_5", patientId: patNatalia, amount: 500, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(5), reference: "ch_mno345" },
      ],
    },
    {
      id: "inv_6", patientId: patCamila, opportunityId: "opp_13", quoteId: null, invoiceNumber: "INV-2026-006", description: "Microneedling Treatment",
      status: "PAID" as const, subtotal: 400, discountAmount: 0, total: 400, amountPaid: 400, balanceDue: 0,
      dueDate: daysAgo(1), paidAt: daysAgo(4), createdAt: daysAgo(4),
      payments: [
        { id: "pay_6", patientId: patCamila, amount: 400, method: "CASH" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(4) },
      ],
    },
    {
      id: "inv_7", patientId: patMaria, opportunityId: "opp_19", quoteId: "quote_7", invoiceNumber: "INV-2026-007", description: "Blepharoplasty - Deposit",
      status: "PARTIAL" as const, subtotal: 4500, discountAmount: 300, total: 4200, amountPaid: 2100, balanceDue: 2100,
      dueDate: daysFromNow(8), createdAt: daysAgo(5),
      payments: [
        { id: "pay_7", patientId: patMaria, amount: 2100, method: "CARD" as const, status: "SUCCEEDED" as const, processedAt: daysAgo(5), reference: "ch_pqr678" },
      ],
    },
    {
      id: "inv_8", patientId: patRobert, opportunityId: "opp_10", quoteId: null, invoiceNumber: "INV-2026-008", description: "Laser Consultation",
      status: "DRAFT" as const, subtotal: 150, discountAmount: 0, total: 150, amountPaid: 0, balanceDue: 150,
      createdAt: daysAgo(1),
      payments: [],
    },
  ];

  for (const inv of invoicesData) {
    const { payments, ...invoiceData } = inv;
    await prisma.invoice.upsert({
      where: { id: inv.id },
      update: {},
      create: {
        id: invoiceData.id,
        practiceId,
        patientId: invoiceData.patientId,
        opportunityId: invoiceData.opportunityId,
        quoteId: invoiceData.quoteId,
        invoiceNumber: invoiceData.invoiceNumber,
        description: invoiceData.description,
        status: invoiceData.status,
        subtotal: invoiceData.subtotal,
        discountAmount: invoiceData.discountAmount,
        total: invoiceData.total,
        amountPaid: invoiceData.amountPaid,
        balanceDue: invoiceData.balanceDue,
        dueDate: invoiceData.dueDate ?? null,
        paidAt: invoiceData.paidAt ?? null,
        createdAt: invoiceData.createdAt,
      },
    });

    for (const p of payments) {
      await prisma.payment.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          practiceId,
          patientId: p.patientId,
          invoiceId: inv.id,
          amount: p.amount,
          method: p.method,
          status: p.status,
          processedAt: p.processedAt ?? null,
          stripePaymentIntentId: (p as any).reference ?? null,
        },
      });
    }
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("   - 1 Practice");
  console.log("   - 5 Users");
  console.log("   - 2 Pipelines with 19 stages");
  console.log("   - 12 Procedures");
  console.log("   - 15 Patients");
  console.log("   - 29 Opportunities");
  console.log("   - 33 Appointments");
  console.log("   - 22 Activities");
  console.log("   - 10 Quotes with line items");
  console.log("   - 5 Treatment Plans with items");
  console.log("   - 12 Opportunity Forms");
  console.log("   - 8 Invoices with payments");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
