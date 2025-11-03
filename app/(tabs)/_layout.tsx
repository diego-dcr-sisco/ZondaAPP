import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            backgroundColor: "#ffffff",
          },
          default: {
            backgroundColor: "#ffffff",
          },
        }),
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: "Reportes",
          tabBarIcon: ({ color }) => (
            <Ionicons name="albums" size={20} color="" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={20} color="" /> 
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "Sincronización",
          tabBarIcon: ({ color }) => (
            <Ionicons name="sync" size={20} color="" /> 
          ),
        }}
      />
      <Tabs.Screen
        name="order-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="service-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="device-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
