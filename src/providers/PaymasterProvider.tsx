import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { PaymasterContextValue, PaymasterRequest, sponsorTransaction } from "../services/paymaster";

const PaymasterContext = createContext<PaymasterContextValue | undefined>(undefined);

export const PaymasterProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isSponsoring, setIsSponsoring] = useState(false);
  const [lastSponsorError, setLastSponsorError] = useState<string | null>(null);

  const sponsor = useCallback(async (request: PaymasterRequest) => {
    try {
      setIsSponsoring(true);
      setLastSponsorError(null);
      return await sponsorTransaction(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sponsor transaction";
      setLastSponsorError(message);
      throw err;
    } finally {
      setIsSponsoring(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      sponsor,
      isSponsoring,
      lastSponsorError,
    }),
    [sponsor, isSponsoring, lastSponsorError]
  );

  return <PaymasterContext.Provider value={value}>{children}</PaymasterContext.Provider>;
};

export const usePaymaster = (): PaymasterContextValue => {
  const ctx = useContext(PaymasterContext);
  if (!ctx) {
    throw new Error("usePaymaster must be used inside a PaymasterProvider");
  }
  return ctx;
};
