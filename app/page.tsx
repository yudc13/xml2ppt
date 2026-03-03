"use client";

import { useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SlideViewport } from "@/components/editor/slide-viewport";
import { slides as mockSlides } from "@/mock/slides";

const INITIAL_ACTIVE_SLIDE_INDEX = 0;

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractSlideTitle(slideXml: string): string {
  const spanMatch = slideXml.match(/<shape[^>]*type="text"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  if (!spanMatch) {
    return "Untitled Slide";
  }

  const text = decodeXmlEntities(spanMatch[1]).replace(/<[^>]+>/g, "").trim();
  return text.length > 0 ? text : "Untitled Slide";
}

const SLIDE_NUMBERS = mockSlides.map((_, index) => index + 1);
const SLIDE_TITLES = mockSlides.map((slideXml) => extractSlideTitle(slideXml));

export default function Home() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(INITIAL_ACTIVE_SLIDE_INDEX);

  return (
    <div className="flex h-screen flex-col bg-[#f2f4f7] text-slate-900 overflow-hidden font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          slides={SLIDE_NUMBERS}
          slideTitles={SLIDE_TITLES}
          activeSlide={activeSlideIndex + 1}
          onSlideSelect={(slideNumber) => setActiveSlideIndex(slideNumber - 1)}
        />

        <main className="flex-1 overflow-auto bg-[#f8fafc]/50 p-8 flex items-center justify-center">
          <SlideViewport slideIndex={activeSlideIndex} />
        </main>
      </div>
    </div>
  );
}
