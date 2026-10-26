"use client";

import {
  type CollisionDetection,
  DndContext,
  type DndContextProps,
  DragOverlay,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useLayoutEffect, useSyncExternalStore } from "react";
import type { Ponte } from "./ponte";

// Motor de arrastar e soltar (@dnd-kit), carregado depois da hidratação
// por useMotor (./ponte.ts). Não desenha nada na tela: cada elemento que a
// tela cadastrou na ponte vira um arrastável ou um soltável do DndContext
// (o nó é o mesmo elemento já desenhado), e os ouvintes dos sensores voltam
// para a ponte, que os repassa aos eventos do elemento. Só a cópia que
// segue o ponteiro (DragOverlay) e os avisos do leitor de tela são do
// @dnd-kit, como antes.

export interface PropsMotor
  extends Pick<
    DndContextProps,
    | "onDragStart"
    | "onDragOver"
    | "onDragEnd"
    | "onDragCancel"
    | "accessibility"
  > {
  ponte: Ponte;
  /** "ponteiro": onde o ponteiro está; "ponteiroOuArea": no teclado, a área que o cartão cobre mais. */
  colisao: "ponteiro" | "ponteiroOuArea";
  /** Setas do teclado (padrão do @dnd-kit sem isto). */
  teclado?: KeyboardCoordinateGetter;
  /** Cópia que segue o ponteiro durante o arraste. */
  sobreposicao: ReactNode;
}

/** Ponteiro em cima da área; no teclado, a que o elemento cobre mais. */
const ponteiroOuArea: CollisionDetection = (args) => {
  const sob = pointerWithin(args);
  return sob.length ? sob : rectIntersection(args);
};

export function Motor({
  ponte,
  colisao,
  teclado,
  sobreposicao,
  ...eventos
}: PropsMotor) {
  // Redesenha a lista quando um elemento entra ou sai da tela.
  useSyncExternalStore(ponte.assinar, ponte.estado, ponte.estado);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, teclado ? { coordinateGetter: teclado } : {}),
  );
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={
        colisao === "ponteiroOuArea" ? ponteiroOuArea : pointerWithin
      }
      {...eventos}
    >
      {[...ponte.arrastaveis].map(([id, no]) => (
        <Arrastavel key={id} ponte={ponte} id={id} no={no} />
      ))}
      {[...ponte.soltaveis].map(([id, no]) => (
        <Soltavel key={id} id={id} no={no} />
      ))}
      <DragOverlay dropAnimation={null}>{sobreposicao}</DragOverlay>
    </DndContext>
  );
}

function Arrastavel({
  ponte,
  id,
  no,
}: {
  ponte: Ponte;
  id: string;
  no: HTMLElement;
}) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id });
  useLayoutEffect(() => {
    setNodeRef(no);
  }, [setNodeRef, no]);
  useLayoutEffect(() => {
    ponte.ligar(id, listeners);
    return () => ponte.desligar(id, listeners);
  }, [ponte, id, listeners]);
  const descricao = attributes["aria-describedby"];
  useLayoutEffect(() => {
    ponte.descrever(descricao);
  }, [ponte, descricao]);
  return null;
}

function Soltavel({ id, no }: { id: string; no: HTMLElement }) {
  const { setNodeRef } = useDroppable({ id });
  useLayoutEffect(() => {
    setNodeRef(no);
  }, [setNodeRef, no]);
  return null;
}
