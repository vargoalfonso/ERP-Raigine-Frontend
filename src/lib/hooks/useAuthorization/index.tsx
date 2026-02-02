"use client";

import { PayloadToken } from "@/types";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { useState, useEffect } from "react";

export const useAuthorization = () => {
  const token = Cookies.get("Authorization");

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    let decoded: PayloadToken | null = null;

    if (token) {
      try {
        decoded = jwtDecode<PayloadToken>(token);

        setIsAuthorized(true);
        setUserRole(decoded?.role || "");
        setUserId(decoded?.id || "");
      } catch (error) {
        console.error("Error decoding token:", error);
        setIsAuthorized(false);
        setUserRole("");
        setUserId("");
      }
    } else {
      setIsAuthorized(false);
      setUserRole("");
      setUserId("");
    }
  }, [token]);

  return {
    isAuthorized,
    userRole,
    userId,
    token,
  };
};
