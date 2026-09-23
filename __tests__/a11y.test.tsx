import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import AdminDashboard from "../components/AdminDashboard";
import LoginPage from "../app/admin/login/page";

describe("Accessibility (a11y)", () => {
  it("AdminDashboard should have no a11y violations", async () => {
    // Mock the data passed to the client component
    const { container } = render(
      <AdminDashboard
        initialRegistrants={[]}
        pickupPoints={[]}
        role="admin"
        selfEmail="test@example.com"
        eventInfo={{ venue_name: "Test", venue_lat: 0, venue_lng: 0, faq: [] }}
        duplicates={[]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("LoginPage should have no a11y violations", async () => {
    const { container } = render(<LoginPage searchParams={{}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
