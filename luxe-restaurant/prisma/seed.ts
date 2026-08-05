import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Hokkaido Uni, Yuzu Kosho",
        slug: "hokkaido-uni-yuzu-kosho",
        description: "Sea urchin, citrus-chili, brioche crumb.",
        category: "AMUSE_BOUCHE",
        priceCents: 0,
        allergens: ["shellfish", "gluten"],
        isSignature: true,
        sortOrder: 1,
      },
      {
        name: "Charred Octopus",
        slug: "charred-octopus",
        description: "Smoked paprika, fingerling confit, lemon.",
        category: "APPETIZER",
        priceCents: 2800,
        allergens: ["shellfish"],
        sortOrder: 1,
      },
      {
        name: "Dry-Aged Wagyu, Bone Marrow Jus",
        slug: "dry-aged-wagyu",
        description: "45-day dry-aged striploin, charred cipollini, marrow jus.",
        category: "MAIN",
        priceCents: 9800,
        allergens: [],
        isSignature: true,
        sortOrder: 1,
      },
      {
        name: "Valrhona Chocolate, Sea Salt",
        slug: "valrhona-chocolate",
        description: "Molten center, olive oil crumble, fleur de sel.",
        category: "DESSERT",
        priceCents: 1800,
        allergens: ["dairy", "gluten"],
        sortOrder: 1,
      },
      {
        name: "Nine-Course Tasting Menu",
        slug: "nine-course-tasting",
        description: "The full narrative, chef's discretion. Wine pairing available.",
        category: "TASTING_MENU",
        priceCents: 22000,
        allergens: [],
        isSignature: true,
        sortOrder: 1,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
