export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      dishes: {
        Row: {
          created_at: string
          description: string
          id: string
          is_hidden: boolean
          name: string
          price_cents: number
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_hidden?: boolean
          name: string
          price_cents: number
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_hidden?: boolean
          name?: string
          price_cents?: number
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_financials: {
        Row: {
          commission_cents: number
          commission_percent: number
          created_at: string
          order_id: string
          payment_captured: boolean
          restaurant_id: string
          restaurant_payout_cents: number
        }
        Insert: {
          commission_cents: number
          commission_percent: number
          created_at?: string
          order_id: string
          payment_captured?: boolean
          restaurant_id: string
          restaurant_payout_cents: number
        }
        Update: {
          commission_cents?: number
          commission_percent?: number
          created_at?: string
          order_id?: string
          payment_captured?: boolean
          restaurant_id?: string
          restaurant_payout_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_financials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_financials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          dish_id: string | null
          dish_name: string
          id: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          dish_id?: string | null
          dish_name: string
          id?: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          dish_id?: string | null
          dish_name?: string
          id?: string
          order_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          code: string
          confirmed_at: string | null
          created_at: string
          decline_reason: string | null
          discount_cents: number
          discount_percent: number
          id: string
          meal_count: number
          menu_total_cents: number
          picked_up_at: string | null
          placed_at: string | null
          ready_at: string | null
          response_deadline: string | null
          restaurant_id: string
          slot_id: string
          slot_start: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          student_email: string | null
          student_first_name: string
          student_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          code: string
          confirmed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          discount_cents: number
          discount_percent: number
          id?: string
          meal_count: number
          menu_total_cents: number
          picked_up_at?: string | null
          placed_at?: string | null
          ready_at?: string | null
          response_deadline?: string | null
          restaurant_id: string
          slot_id: string
          slot_start: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          student_email?: string | null
          student_first_name?: string
          student_id: string
          total_cents: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          code?: string
          confirmed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          discount_cents?: number
          discount_percent?: number
          id?: string
          meal_count?: number
          menu_total_cents?: number
          picked_up_at?: string | null
          placed_at?: string | null
          ready_at?: string | null
          response_deadline?: string | null
          restaurant_id?: string
          slot_id?: string
          slot_start?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          student_email?: string | null
          student_first_name?: string
          student_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "pickup_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_hours: {
        Row: {
          capacity: number
          created_at: string
          end_hour: number
          id: string
          restaurant_id: string
          start_hour: number
          weekday: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          end_hour: number
          id?: string
          restaurant_id: string
          start_hour: number
          weekday: number
        }
        Update: {
          capacity?: number
          created_at?: string
          end_hour?: number
          id?: string
          restaurant_id?: string
          start_hour?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "pickup_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_slots: {
        Row: {
          capacity: number
          id: string
          restaurant_id: string
          start_time: string
        }
        Insert: {
          capacity: number
          id?: string
          restaurant_id: string
          start_time: string
        }
        Update: {
          capacity?: number
          id?: string
          restaurant_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_slots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
        }
        Insert: {
          created_at?: string
          first_name?: string
          id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
        }
        Relationships: []
      }
      restaurant_private: {
        Row: {
          commission_percent: number
          contact_name: string
          email: string | null
          phone: string
          restaurant_id: string
        }
        Insert: {
          commission_percent?: number
          contact_name?: string
          email?: string | null
          phone?: string
          restaurant_id: string
        }
        Update: {
          commission_percent?: number
          contact_name?: string
          email?: string | null
          phone?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_private_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          created_at: string
          cuisine: string
          discount_percent: number
          id: string
          is_approved: boolean
          is_demo: boolean
          lead_time_hours: number
          max_meals: number
          min_meals: number
          name: string
          owner_id: string | null
          slug: string
          timezone: string
        }
        Insert: {
          address: string
          created_at?: string
          cuisine: string
          discount_percent?: number
          id?: string
          is_approved?: boolean
          is_demo?: boolean
          lead_time_hours?: number
          max_meals?: number
          min_meals?: number
          name: string
          owner_id?: string | null
          slug: string
          timezone?: string
        }
        Update: {
          address?: string
          created_at?: string
          cuisine?: string
          discount_percent?: number
          id?: string
          is_approved?: boolean
          is_demo?: boolean
          lead_time_hours?: number
          max_meals?: number
          min_meals?: number
          name?: string
          owner_id?: string | null
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_order_count: { Args: { _slot_id: string }; Returns: number }
      available_slots: {
        Args: { _restaurant_id: string }
        Returns: {
          capacity: number
          remaining: number
          slot_id: string
          start_time: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_restaurant: { Args: { _restaurant_id: string }; Returns: boolean }
      regenerate_all_slots: { Args: never; Returns: undefined }
      regenerate_slots: { Args: { _restaurant_id: string }; Returns: undefined }
      restaurant_cards: {
        Args: never
        Returns: {
          address: string
          cuisine: string
          discount_percent: number
          id: string
          is_demo: boolean
          max_meals: number
          min_meals: number
          name: string
          next_slot: string
          slug: string
          timezone: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "restaurant"
      order_status:
        | "pending_payment"
        | "awaiting_restaurant"
        | "confirmed"
        | "ready"
        | "picked_up"
        | "declined"
        | "expired"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "restaurant"],
      order_status: [
        "pending_payment",
        "awaiting_restaurant",
        "confirmed",
        "ready",
        "picked_up",
        "declined",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
