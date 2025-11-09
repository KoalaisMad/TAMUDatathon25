"use client";

import { Menu, ArrowRight, Shield, MapPin, Users, Star, Check } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NavigationMenu from "./components/Navigation";

export default function LandingPage() {
  const router = useRouter();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const features = [
    {
      icon: Shield,
      title: "Safety First",
      description: "AI-powered route safety analysis to keep you secure on every journey"
    },
    {
      icon: MapPin,
      title: "Smart Navigation",
      description: "Real-time route optimization with multiple transport options"
    },
    {
      icon: Users,
      title: "Emergency Support",
      description: "Instant emergency contact notifications when you need them most"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "College Student",
      text: "GirlBoss makes me feel safe walking home at night. The route safety features are a game-changer!",
      rating: 5
    },
    {
      name: "Jessica L.",
      role: "Professional",
      text: "I love how easy it is to plan my commute. The app considers safety and convenience perfectly.",
      rating: 5
    },
    {
      name: "Emma R.",
      role: "Traveler",
      text: "Finally, an app that understands the unique safety concerns women face. Highly recommend!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen ">
      <NavigationMenu isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="cursor-pointer hover:opacity-80 transition-opacity">
            <Image
              src="/girlboss.png"
              alt="GirlBoss Logo"
              width={150}
              height={150}
              className="rounded-lg"
            />
          </button>
        </div>
        <button 
          onClick={() => setIsNavOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-semibold text-center mb-6">
              Safety one step at a time!
            </h1>
            <p className="text-gray-600 mb-8 text-center mx-12">
              Find the safest possible way to travel from 2 locations
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button className="bg-[#FF2A8A] text-white">
                Login with Google
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-8 pb-20 bg-white">
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold mb-4">
            Latest technologies are used to maximize user saftey
            </h2>
            <p className="text-gray-600  mx-auto">
              More than just navigation – your personal safety companion for every journey
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-8 bg-white border-2 border-gray-200 rounded-2xl hover:border-pink-500 transition-all hover:shadow-xl">
                <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
