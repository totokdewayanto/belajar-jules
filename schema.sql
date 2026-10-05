-- Supabase PostgreSQL Schema

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    address TEXT
);

-- Create items table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    "categoryId" UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    "supplierId" UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    "minStock" INTEGER NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0
);

-- Create incoming transactions table
CREATE TABLE IF NOT EXISTS public.incoming (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "itemId" UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    date DATE NOT NULL,
    note TEXT
);

-- Create outgoing transactions table
CREATE TABLE IF NOT EXISTS public.outgoing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "itemId" UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    date DATE NOT NULL,
    note TEXT
);

-- Function to handle incoming stock updates
CREATE OR REPLACE FUNCTION update_stock_incoming()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.items SET stock = stock + NEW.quantity WHERE id = NEW."itemId";
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."itemId" = OLD."itemId" THEN
            UPDATE public.items SET stock = stock - OLD.quantity + NEW.quantity WHERE id = NEW."itemId";
        ELSE
            UPDATE public.items SET stock = stock - OLD.quantity WHERE id = OLD."itemId";
            UPDATE public.items SET stock = stock + NEW.quantity WHERE id = NEW."itemId";
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.items SET stock = stock - OLD.quantity WHERE id = OLD."itemId";
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for incoming table
DROP TRIGGER IF EXISTS trigger_update_stock_incoming ON public.incoming;
CREATE TRIGGER trigger_update_stock_incoming
AFTER INSERT OR UPDATE OR DELETE ON public.incoming
FOR EACH ROW EXECUTE FUNCTION update_stock_incoming();

-- Function to handle outgoing stock updates
CREATE OR REPLACE FUNCTION update_stock_outgoing()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.items SET stock = stock - NEW.quantity WHERE id = NEW."itemId";
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."itemId" = OLD."itemId" THEN
            UPDATE public.items SET stock = stock + OLD.quantity - NEW.quantity WHERE id = NEW."itemId";
        ELSE
            UPDATE public.items SET stock = stock + OLD.quantity WHERE id = OLD."itemId";
            UPDATE public.items SET stock = stock - NEW.quantity WHERE id = NEW."itemId";
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.items SET stock = stock + OLD.quantity WHERE id = OLD."itemId";
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for outgoing table
DROP TRIGGER IF EXISTS trigger_update_stock_outgoing ON public.outgoing;
CREATE TRIGGER trigger_update_stock_outgoing
AFTER INSERT OR UPDATE OR DELETE ON public.outgoing
FOR EACH ROW EXECUTE FUNCTION update_stock_outgoing();
