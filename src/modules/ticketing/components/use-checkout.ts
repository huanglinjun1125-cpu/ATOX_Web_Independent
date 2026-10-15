"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyAnswers, TICKETING_PAGE } from "../contracts";
import type {
  BuyerAnswers,
  CatalogDto,
  CreateOrderInput,
  OrderDto,
  OrderListDto,
  QuoteDto,
  Selection,
  SimulationAction,
} from "../contracts";
import { ticketRequest, TicketError } from "../client";
import { ticketErrorMessages } from "../i18n";
import { storageRead, storageWrite, useTicketText } from "./shared";

function answersValid(answers: BuyerAnswers, catalog: CatalogDto) {
  return (
    !!answers.displayName.trim() &&
    answers.displayName.length <= 100 &&
    !!answers.country.trim() &&
    answers.country.length <= 100 &&
    catalog.questions.sources.some((item) => item.id === answers.source) &&
    answers.purposes.length > 0 &&
    answers.purposes.every((id) =>
      catalog.questions.purposes.some((item) => item.id === id),
    ) &&
    answers.notes.length <= 2000 &&
    answers.acceptedPolicy
  );
}
const payable = (order: OrderDto) =>
  order.status === "pending" &&
  order.canPay &&
  !order.reconciliationRequired &&
  ["idle", "failed", "cancelled"].includes(order.paymentStatus);

export function useCheckout({
  catalog,
  user,
  selection,
  orderId,
}: {
  catalog: CatalogDto;
  user: { id: string; email: string };
  selection: Selection;
  orderId?: string;
}) {
  const { language, t } = useTicketText();
  const router = useRouter();
  const key = `ticketing:${catalog.event.id}:${user.id}:answers`;
  const operationKey = `ticketing:${catalog.event.id}:${user.id}:operation`;
  const [answers, setAnswers] = useState<BuyerAnswers>(emptyAnswers());
  const [quoteResult, setQuoteResult] = useState<{
    fingerprint: string;
    value: QuoteDto;
  } | null>(null);
  const [policy, setPolicy] = useState(catalog.event.policy);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [failure, setFailure] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [serverElapsed, setServerElapsed] = useState(0);
  const operation = useRef<CreateOrderInput | null>(null);
  const locked = useRef(false);
  const lastOrderId = useRef(orderId);
  const quoteRequest = useRef<AbortController | null>(null);
  const quoteEpoch = useRef(0);
  const orderEpoch = useRef(0);
  const initialized = useRef("");
  const fingerprint = JSON.stringify({ ...selection, answers });
  const quote =
    quoteResult?.fingerprint === fingerprint ? quoteResult.value : null;
  const valid = answersValid(answers, catalog);
  const selected = catalog.tickets.find(
    (item) => item.id === selection.ticketId,
  );
  const effective = order
    ? { ticketId: order.ticketId, quantity: order.quantity }
    : selection;
  const error = failure
    ? (ticketErrorMessages[failure]?.[language] ??
      (t as Record<string, string>)[failure] ??
      t.error)
    : "";

  function remember(request: CreateOrderInput | null) {
    operation.current = request;
    storageWrite(operationKey, request);
  }
  function report(error: unknown) {
    if (error instanceof TicketError && error.status === 401) {
      router.replace(
        "/login?next=" +
          encodeURIComponent(
            TICKETING_PAGE +
              "/checkout?" +
              (lastOrderId.current
                ? new URLSearchParams({ orderId: lastOrderId.current })
                : new URLSearchParams({
                    ticketId: selection.ticketId,
                    quantity: String(selection.quantity),
                  })),
          ),
      );
    }
    setFailure(error instanceof TicketError ? error.code : "network");
  }
  function adopt(next: OrderDto) {
    setOrder(next);
    lastOrderId.current = next.id;
    setUncertain(false);
    setCreationUncertain(false);
    setExistingOrderId(null);
    remember(null);
    if (["pending", "creating", "unknown"].includes(next.paymentStatus))
      setSimulatorOpen(true);
  }
  function begin() {
    if (locked.current) return false;
    locked.current = true;
    orderEpoch.current++;
    setBusy(true);
    setFailure("");
    return true;
  }
  function end() {
    locked.current = false;
    setBusy(false);
  }
  function navigateOrder(id: string) {
    const href = TICKETING_PAGE + "/checkout?orderId=" + encodeURIComponent(id);
    // Commit the recoverable URL synchronously before starting the payment.
    // Next.js supports native history updates; replace also refreshes server props.
    window.history.replaceState(null, "", href);
    router.replace(href);
  }
  async function refresh(id = lastOrderId.current) {
    if (!id || !begin()) return;
    try {
      adopt(await ticketRequest<OrderDto>("/orders/" + encodeURIComponent(id)));
    } catch (error) {
      report(error);
    } finally {
      end();
    }
  }

  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(
      () => setServerElapsed(performance.now() - start),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (initialized.current !== key) {
        initialized.current = key;
        setAnswers(storageRead(key, emptyAnswers()));
        const saved = storageRead<CreateOrderInput | null>(operationKey, null);
        if (saved?.idempotencyKey && saved.answers && saved.quoteVersion) {
          operation.current = saved;
          setAnswers(saved.answers);
          setCreationUncertain(true);
        }
      }
      if (!orderId || (orderId === lastOrderId.current && locked.current)) {
        setReady(true);
        return;
      }
      setReady(false);
      const epoch = orderEpoch.current;
      ticketRequest<OrderDto>(
        "/orders/" + encodeURIComponent(orderId),
        "GET",
        undefined,
        controller.signal,
      )
        .then((next) => {
          if (active && epoch === orderEpoch.current) {
            setOrder(next);
            lastOrderId.current = next.id;
            operation.current = null;
            storageWrite(operationKey, null);
            setCreationUncertain(false);
            setUncertain(false);
            if (["pending", "creating", "unknown"].includes(next.paymentStatus))
              setSimulatorOpen(true);
          }
        })
        .catch((error) => {
          if (active && !controller.signal.aborted) {
            setFailure(error instanceof TicketError ? error.code : "network");
            if (error instanceof TicketError && error.status === 401)
              router.replace(
                "/login?next=" +
                  encodeURIComponent(
                    TICKETING_PAGE + "/checkout?orderId=" + orderId,
                  ),
              );
          }
        })
        .finally(() => {
          if (active) setReady(true);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, operationKey, orderId, router]);

  useEffect(() => {
    if (
      !ready ||
      order ||
      orderId ||
      creationUncertain ||
      existingOrderId ||
      !valid ||
      !selected
    )
      return;
    const controller = new AbortController();
    quoteRequest.current = controller;
    const epoch = ++quoteEpoch.current;
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setFailure("");
      try {
        const next = await ticketRequest<QuoteDto>(
          "/quote",
          "POST",
          JSON.parse(fingerprint),
          controller.signal,
        );
        if (controller.signal.aborted || epoch !== quoteEpoch.current) return;
        if (JSON.stringify(next.policy) !== JSON.stringify(policy)) {
          setPolicy(next.policy);
          setAnswers((previous) => {
            const updated = { ...previous, acceptedPolicy: false };
            storageWrite(key, updated);
            return updated;
          });
          setQuoteResult(null);
          setFailure("policyChanged");
        } else setQuoteResult({ fingerprint, value: next });
      } catch (error) {
        if (controller.signal.aborted || epoch !== quoteEpoch.current) return;
        if (
          error instanceof TicketError &&
          error.code === "PENDING_ORDER_EXISTS"
        ) {
          setExistingOrderId((error.data as { orderId: string }).orderId);
          setQuoteResult(null);
        } else {
          setFailure(error instanceof TicketError ? error.code : "network");
          if (error instanceof TicketError && error.status === 401)
            router.replace(
              "/login?next=" +
                encodeURIComponent(
                  TICKETING_PAGE +
                    "/checkout?" +
                    new URLSearchParams({
                      ticketId: selection.ticketId,
                      quantity: String(selection.quantity),
                    }),
                ),
            );
        }
      } finally {
        if (!controller.signal.aborted && epoch === quoteEpoch.current)
          setQuoteLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    ready,
    order,
    orderId,
    creationUncertain,
    existingOrderId,
    valid,
    selected,
    fingerprint,
    policy,
    key,
    quoteRetry,
    router,
    selection.ticketId,
    selection.quantity,
  ]);

  const pollingId = order?.id;
  const pollingStatus = order?.status;
  useEffect(() => {
    if (!pollingId || pollingStatus !== "pending") return;
    let active = true;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (locked.current || inFlight || document.visibilityState !== "visible")
        return;
      inFlight = true;
      const epoch = orderEpoch.current;
      try {
        const next = await ticketRequest<OrderDto>("/orders/" + pollingId);
        if (active && epoch === orderEpoch.current && !locked.current) {
          setOrder(next);
          setUncertain(false);
          setFailure("");
        }
      } catch {
        if (active && epoch === orderEpoch.current) setFailure("network");
      } finally {
        inFlight = false;
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pollingId, pollingStatus]);

  function changeAnswers(next: BuyerAnswers) {
    if (locked.current || creationUncertain || order) return;
    quoteRequest.current?.abort();
    quoteEpoch.current++;
    setQuoteLoading(false);
    setQuoteResult(null);
    setAnswers(next);
    storageWrite(key, next);
    remember(null);
    setFailure("");
  }
  function retryQuote() {
    setQuoteResult(null);
    setFailure("");
    setQuoteRetry((value) => value + 1);
  }
  async function initiatePayment(next: OrderDto) {
    if (!payable(next)) return;
    setSimulatorOpen(true);
    try {
      adopt(
        await ticketRequest<OrderDto>(
          "/orders/" + next.id + "/payments",
          "POST",
        ),
      );
    } catch (error) {
      setUncertain(true);
      report(error);
    }
  }
  async function create() {
    if (
      !quote ||
      !valid ||
      creationUncertain ||
      existingOrderId ||
      order ||
      !begin()
    )
      return;
    const request = {
      ...selection,
      answers: structuredClone(answers),
      quoteVersion: quote.quoteVersion,
      idempotencyKey: operation.current?.idempotencyKey ?? crypto.randomUUID(),
    };
    remember(request);
    try {
      const next = await ticketRequest<OrderDto>("/orders", "POST", request);
      adopt(next);
      navigateOrder(next.id);
      await initiatePayment(next);
    } catch (error) {
      if (error instanceof TicketError && error.code === "QUOTE_CHANGED") {
        const next = (error.data as { quote?: QuoteDto }).quote;
        remember(null);
        if (next) {
          setPolicy(next.policy);
          if (JSON.stringify(next.policy) !== JSON.stringify(policy)) {
            const updated = { ...answers, acceptedPolicy: false };
            setAnswers(updated);
            storageWrite(key, updated);
            setQuoteResult(null);
            setFailure("policyChanged");
          } else {
            setQuoteResult({ fingerprint, value: next });
            setFailure("refreshQuote");
          }
        } else {
          setQuoteResult(null);
          setFailure("refreshQuote");
        }
      } else if (
        error instanceof TicketError &&
        error.code === "PENDING_ORDER_EXISTS"
      ) {
        remember(null);
        setExistingOrderId((error.data as { orderId: string }).orderId);
        setQuoteResult(null);
      } else if (!(error instanceof TicketError) || error.status >= 500) {
        setCreationUncertain(true);
        setQuoteResult(null);
        setFailure("creationUnknown");
      } else {
        // A definite rejection is safe to edit. An unchanged retry retains its
        // original key; only uncertain requests require persisted restoration.
        storageWrite(operationKey, null);
        report(error);
      }
    } finally {
      end();
    }
  }
  async function recoverCreation() {
    const saved = operation.current;
    if (!saved || !begin()) return;
    try {
      const list = await ticketRequest<OrderListDto>("/orders?page=1");
      const pending = list.orders.find((item) => item.status === "pending");
      // Re-send exactly the persisted request only after querying existing orders.
      // Its original idempotency key also restores closed historical requests.
      const next = pending
        ? await ticketRequest<OrderDto>("/orders/" + pending.id)
        : await ticketRequest<OrderDto>("/orders", "POST", saved);
      adopt(next);
      navigateOrder(next.id);
      // Recovery never automatically starts a payment.
    } catch (error) {
      if (
        error instanceof TicketError &&
        error.status < 500 &&
        error.code !== "UNAUTHORIZED"
      ) {
        remember(null);
        setCreationUncertain(false);
        setQuoteResult(null);
        setFailure(
          error.code === "QUOTE_CHANGED" ? "refreshQuote" : error.code,
        );
      } else report(error);
    } finally {
      end();
    }
  }
  async function pay() {
    if (!order || uncertain || !payable(order) || !begin()) return;
    try {
      await initiatePayment(order);
    } finally {
      end();
    }
  }
  async function simulate(action: SimulationAction) {
    if (!order || !begin()) return;
    try {
      adopt(
        await ticketRequest<OrderDto>(
          "/orders/" + order.id + "/simulate",
          "POST",
          { action },
        ),
      );
    } catch (error) {
      setUncertain(true);
      report(error);
    } finally {
      end();
    }
  }
  function navigateSelection() {
    router.push(
      TICKETING_PAGE +
        "?" +
        new URLSearchParams({
          ticketId: effective.ticketId,
          quantity: String(effective.quantity),
        }),
    );
  }
  function changeSelection() {
    if (locked.current || creationUncertain) return;
    if (
      !order ||
      (order.status === "closed" && !order.reconciliationRequired)
    ) {
      navigateSelection();
      return;
    }
    if (order.status === "paid") {
      router.push(TICKETING_PAGE);
      return;
    }
    if (
      uncertain ||
      ["unknown", "creating"].includes(order.paymentStatus) ||
      order.reconciliationRequired ||
      !order.canClose
    ) {
      setFailure("unknownClose");
      return;
    }
    setConfirmOpen(true);
  }
  async function closeAndChange() {
    if (!order || !begin()) return;
    try {
      const next = await ticketRequest<OrderDto>(
        "/orders/" + order.id + "/close",
        "POST",
      );
      adopt(next);
      if (next.status !== "closed" || next.reconciliationRequired)
        setFailure("unknownClose");
      else {
        setConfirmOpen(false);
        navigateSelection();
      }
    } catch (error) {
      report(error);
    } finally {
      end();
    }
  }
  return {
    answers,
    quote,
    policy,
    order,
    ready,
    busy,
    error,
    uncertain,
    creationUncertain,
    existingOrderId,
    quoteLoading,
    valid,
    serverElapsed,
    selected,
    effective,
    confirmOpen,
    simulatorOpen,
    setConfirmOpen,
    setSimulatorOpen,
    changeAnswers,
    retryQuote,
    create,
    recoverCreation,
    refresh,
    pay,
    simulate,
    changeSelection,
    closeAndChange,
  };
}
