import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/images", { recursive: true });
const assets = {
  "hero-biryani": "photo-1631452180519-c014fe946bc7",
  biryani: "photo-1645177628172-a94c1f96e6db",
  thali: "photo-1546833999-b9f581a1996d",
  paneer: "photo-1631452180519-c014fe946bc7",
  dosa: "photo-1668236543090-82eba5ee5976",
  "veg-biryani": "photo-1645177628172-a94c1f96e6db",
  samosa: "photo-1601050690597-df0568f70950",
  idli: "photo-1589301760014-d929f3979dbc",
  chai: "photo-1571934811356-5cc061b6821f",
};
await Promise.allSettled(
  Object.entries(assets).map(async ([name, id]) => {
    const response = await fetch(
      `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${name.startsWith("hero") ? 1100 : 700}&h=${name.startsWith("hero") ? 1100 : 500}&q=85`,
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      throw new Error(`Failed image: ${name}`);
    await writeFile(
      `public/images/${name}.jpg`,
      Buffer.from(await response.arrayBuffer()),
    );
    console.info(`Saved ${name}.jpg`);
  }),
);
