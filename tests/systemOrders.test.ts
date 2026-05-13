import { describe, expect, it } from "vitest";
import { checkSpecialDate, sendEmailReceipt } from "../src/lib/systemOrders";

describe("webhook.checkSpecialDate", () => {
  it("returns '1' or '2' if the date is a special date", async () => {
    const type1 = await checkSpecialDate("2025-12-30T13:00:00");
    const type2 = await checkSpecialDate("2025-12-31T13:00:00");
    const type3 = await checkSpecialDate("2026-05-09T13:00:00");
    const type4 = await checkSpecialDate("2026-05-10T13:00:00");

    expect(type1).toBe("1");
    expect(type2).toBe("2");
    expect(type3).toBe("1");
    expect(type4).toBe("2");
  });

  it("returns null if the date is not a special date", async () => {
    const type = await checkSpecialDate("2026-05-11T13:00:00");

    expect(type).toBe(null);
  });
});

//describe("webhook.sendEmailReceipt", () => {
  //it("sends an email receipt to the customer", async () => {
    //const numberOrderId = 3160;
    //const email = "emireles.rosas@gmail.com";

   // const result = await sendEmailReceipt(numberOrderId, email);

    //expect(result?.error).toBe(null);
  //});
//});