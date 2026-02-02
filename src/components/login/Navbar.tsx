"use client";

import { ReactNode } from "react";

type NavbarProps = {
  text?: ReactNode;
  button?: ReactNode;
};

export default function Navbar({ text, button }: NavbarProps) {
  return (
    <nav className="w-full flex justify-end items-center px-6 py-4 shadow bg-white">
      <div className="flex items-center gap-2">
        {text}
        {button}
      </div>
    </nav>
  );
}
