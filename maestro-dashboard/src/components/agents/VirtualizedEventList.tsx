
import { useRef, useEffect, forwardRef } from "react";
import { VariableSizeList } from "react-window";
import type { ConversationEvent } from "../../types/models";
import EventBlock from "./EventBlock";
import AutoSizer from "@/components/ui/AutoSizer";

interface VirtualizedEventListProps {
    events: ConversationEvent[];
    agent: "claude" | "codex";
}

const DEFAULT = 100;

const OuterElement = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ style, className, ...rest }, ref) => (
        <div
            ref={ref}
            style={style}
            className={`p-8 ${className ?? ""}`}
            {...rest}
        />
    )
);

OuterElement.displayName = "EventListOuterElement";

const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
    const { events, agent, setRowHeight } = data;
    const event = events[index];
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (rowRef.current) {
            const height = rowRef.current.getBoundingClientRect().height;
            setRowHeight(index, height);
        }
    }, [setRowHeight, index, event]);

    return (
        <div style={style}>
            <div ref={rowRef} className="pb-6">
                <EventBlock event={event} agent={agent} />
            </div>
        </div>
    );
};

export default function VirtualizedEventList({ events, agent }: VirtualizedEventListProps) {
    const listRef = useRef<VariableSizeList>(null);
    const rowHeights = useRef<{ [key: number]: number }>({});

    const setRowHeight = (index: number, size: number) => {
        if (rowHeights.current[index] !== size) {
            rowHeights.current[index] = size;
            listRef.current?.resetAfterIndex(index, false);
        }
    };

    const itemSize = (index: number) => {
        return rowHeights.current[index] ?? DEFAULT;
    };

    // Reset when events change
    useEffect(() => {
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [events]);

    return (
        <div className="flex-1 h-full min-h-0">
            <AutoSizer>
                {({ height, width }: { height: number; width: number }) => (
                    <VariableSizeList
                        height={height}
                        width={width}
                        itemCount={events.length}
                        itemSize={itemSize}
                        overscanCount={5}
                        ref={listRef}
                        itemData={{ events, agent, setRowHeight }}
                        outerElementType={OuterElement}
                    >
                        {({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => (
                            <Row index={index} style={style} data={data} />
                        )}
                    </VariableSizeList>
                )}
            </AutoSizer>
        </div>
    );
}
