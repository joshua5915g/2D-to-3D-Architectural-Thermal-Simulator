import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThermalSim 3D | 2D-to-3D Architectural Thermal Simulator",
  description:
    "AI-driven architectural simulator parsing 2D floorplans into extruded 3D meshes with Physics-Informed Neural Network (PINN) thermal fluid simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} dark`}>
      <body className="min-h-screen bg-black text-white antialiased selection:bg-burgundy selection:text-white">
        {children}
      </body>
    </html>
  );
}
